import { ok } from "../../../lib/api";

/**
 * GET /api/news — fetch Solana news from SolanaFloor.
 * Scrapes publicly available news articles with source attribution.
 */
export async function GET(): Promise<Response> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://solanafloor.com/news", {
      signal: controller.signal,
      headers: { "User-Agent": "InsightBot/1.0 (+https://insight-web-six.vercel.app)" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return ok({ articles: [], error: "SolanaFloor unavailable" });
    }

    const html = await res.text();
    const articles = parseArticles(html);

    return ok({
      articles,
      count: articles.length,
      source: "SolanaFloor",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return ok({ articles: [], error: error instanceof Error ? error.message : "unknown" });
  }
}

interface Article {
  title: string;
  category: string;
  author: string;
  date: string;
  summary: string;
  url: string;
  image?: string;
}

function parseArticles(html: string): Article[] {
  const articles: Article[] = [];

  // Try __NEXT_DATA__ JSON first
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]!);
      const props = data?.props?.pageProps ?? {};
      // Try various possible article array locations
      const items = props.articles ?? props.newsArticles ?? props.items ?? props.posts ?? [];
      for (const item of items) {
        if (!item?.title) continue;
        const url = item.slug ? `https://solanafloor.com${item.slug}` : (item.url ?? "");
        if (!articles.some((a) => a.url === url)) {
          articles.push({
            title: item.title,
            category: item.category?.name ?? item.category ?? "News",
            author: item.author?.name ?? item.author ?? "SolanaFloor",
            date:
              item.date_published ??
              item.published_at ??
              item.created_at ??
              new Date().toISOString(),
            summary: item.description ?? item.summary ?? item.excerpt ?? "",
            url,
            image: item.image ?? item.featured_image ?? undefined,
          });
        }
      }
    } catch {
      /* fall through to HTML parsing */
    }
  }

  // Fallback: extract from visible HTML (article links + titles)
  if (articles.length === 0) {
    const linkPattern = /href="(\/(?:news|solana-news)\/[^"]+)"[^>]*>([^<]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(html)) !== null && articles.length < 15) {
      const url = `https://solanafloor.com${match[1]}`;
      const title = match[2]!.trim();
      if (title.length > 10 && !articles.some((a) => a.url === url)) {
        articles.push({
          title,
          category: "News",
          author: "SolanaFloor",
          date: new Date().toISOString(),
          summary: "",
          url,
        });
      }
    }
  }

  // Also try extracting article data from Next.js RSC stream
  if (articles.length === 0) {
    // Look for article title patterns in the HTML
    const titlePattern = /"title":"([^"]{20,})"/g;
    const slugPattern = /"slug":"(\/(?:news|solana-news)\/[^"]+)"/g;
    const titles: string[] = [];
    const slugs: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = titlePattern.exec(html)) !== null) titles.push(m[1]!);
    while ((m = slugPattern.exec(html)) !== null) slugs.push(m[1]!);
    for (let i = 0; i < Math.min(titles.length, slugs.length, 15); i++) {
      const url = `https://solanafloor.com${slugs[i]}`;
      if (!articles.some((a) => a.url === url)) {
        articles.push({
          title: titles[i]!,
          category: "News",
          author: "SolanaFloor",
          date: new Date().toISOString(),
          summary: "",
          url,
        });
      }
    }
  }

  return articles;
}
