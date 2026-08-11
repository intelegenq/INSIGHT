import { ok } from "../../../lib/api";

/**
 * GET /api/social — fetch recent Solana-ecosystem posts from X/Twitter via
 * Nitter RSS mirrors (no auth, no API key). Nitter instances are volatile,
 * so we race several and fall back gracefully. Returns [] if all are down —
 * the UI degrades silently rather than showing fake data.
 */

// Curated Solana ecosystem accounts worth surfacing.
const ACCOUNTS = ["solana", "JupiterExchange", "KaminoFinance", "RaydiumProtocol", "solanafloor"];

// Public Nitter instances (rotate — many go down without notice).
const NITTER_HOSTS = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
  "https://xcancel.com",
];

interface SocialPost {
  author: string;
  handle: string;
  text: string;
  url: string;
  date: string;
  source: "X";
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Nitter instances often return placeholder/error text instead of real posts.
const REJECT_PATTERNS = [
  "rss reader not yet whitelisted",
  "instance has been rate limited",
  "tweets feed is currently unavailable",
  "user not found",
  "error",
  "making requests to the instance",
];

async function fetchAccount(handle: string): Promise<SocialPost[]> {
  // Node's fetch can't decode some Nitter instances' compressed RSS (empty body).
  // Use the public rss2json bridge which normalises the feed to JSON, and fall
  // back to direct Nitter hosts if the bridge is unavailable.
  for (const host of NITTER_HOSTS) {
    try {
      const bridge = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
        `${host}/${handle}/rss`,
      )}`;
      const res = await fetch(bridge, { signal: AbortSignal.timeout(9000), next: { revalidate: 1800 } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        status?: string;
        items?: Array<{ title?: string; link?: string; pubDate?: string }>;
      };
      if (data.status !== "ok" || !data.items?.length) continue;
      const posts: SocialPost[] = [];
      for (const it of data.items) {
        let text = stripHtml(it.title ?? "").replace(/^R to @\w+:\s*/i, "").trim();
        if (text.length < 8) continue;
        const lower = text.toLowerCase();
        if (REJECT_PATTERNS.some((p) => lower.includes(p))) continue;
        let url = (it.link ?? "").trim();
        if (!/\/status\/\d+/.test(url)) continue;
        url = url.replace(/https?:\/\/[^/]+/, "https://x.com").replace(/#m$/, "");
        const date = it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString();
        posts.push({ author: handle, handle, text, url, date, source: "X" });
        if (posts.length >= 5) break;
      }
      if (posts.length > 0) return posts;
    } catch {
      /* try next host */
    }
  }
  return [];
}

export async function GET(): Promise<Response> {
  try {
    const results = await Promise.all(ACCOUNTS.map((a) => fetchAccount(a)));
    const posts = results
      .flat()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);

    return ok({
      posts,
      count: posts.length,
      source: "X (via Nitter)",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return ok({ posts: [], error: error instanceof Error ? error.message : "unknown" });
  }
}
