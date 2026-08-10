/**
 * SolanaFloorNewsProvider — scrapes SolanaFloor.com for Solana-specific news.
 *
 * SolanaFloor does not have a public RSS/API. This provider fetches the
 * /news page HTML and parses article data from Next.js __NEXT_DATA__ JSON
 * embedded in the page. Each article has: title, category, author, date,
 * summary, URL, and image.
 *
 * This is a read-only scrape of publicly available content — no bypass
 * of protections, no rate-limit circumvention. Cache results to minimize
 * requests.
 */

import type { ProviderFetch, RawNarrative } from "../../interfaces/DataProvider";
import { BaseProvider } from "../base/BaseProvider";
import type { BaseProviderOptions } from "../base/BaseProvider";

export interface SolanaFloorArticle {
  title: string;
  category: string;
  author: string;
  date: string;
  summary: string;
  url: string;
  image?: string;
}

export interface SolanaFloorConfig {
  /** Base URL. Defaults to https://solanafloor.com */
  baseUrl?: string;
  /** Request timeout. Defaults to 8000ms */
  timeout?: number;
}

const DEFAULT_BASE = "https://solanafloor.com";

export class SolanaFloorNewsProvider {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: SolanaFloorConfig = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE;
    this.timeout = config.timeout ?? 8000;
  }

  protected async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(`${this.baseUrl}/news`, {
        signal: controller.signal,
        headers: { "User-Agent": "InsightBot/1.0 (+https://insight-web-six.vercel.app)" },
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch news articles from SolanaFloor /news page.
   * Parses Next.js __NEXT_DATA__ JSON from HTML.
   */
  async fetchNews(): Promise<SolanaFloorArticle[]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(`${this.baseUrl}/news`, {
        signal: controller.signal,
        headers: { "User-Agent": "InsightBot/1.0 (+https://insight-web-six.vercel.app)" },
      });
      clearTimeout(timer);

      if (!res.ok) return [];

      const html = await res.text();
      return this.parseArticles(html);
    } catch {
      return [];
    }
  }

  /**
   * Parse articles from SolanaFloor HTML.
   * Extracts __NEXT_DATA__ JSON and pulls article entries.
   */
  private parseArticles(html: string): SolanaFloorArticle[] {
    const articles: SolanaFloorArticle[] = [];

    // Try to extract __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (!nextDataMatch) {
      // Fallback: parse from visible HTML
      return this.parseFromHTML(html);
    }

    try {
      const data = JSON.parse(nextDataMatch[1]!);
      // Navigate: props.pageProps.articles or similar
      const props = data?.props?.pageProps ?? {};
      const items = props.articles ?? props.newsArticles ?? props.items ?? [];

      for (const item of items) {
        if (!item?.title) continue;
        articles.push({
          title: item.title,
          category: item.category?.name ?? item.category ?? "News",
          author: item.author?.name ?? item.author ?? "SolanaFloor",
          date:
            item.date_published ?? item.published_at ?? item.created_at ?? new Date().toISOString(),
          summary: item.description ?? item.summary ?? item.excerpt ?? "",
          url: item.slug ? `${this.baseUrl}${item.slug}` : (item.url ?? ""),
          image: item.image ?? item.featured_image ?? undefined,
        });
      }
    } catch {
      // Fallback to HTML parsing
      return this.parseFromHTML(html);
    }

    return articles;
  }

  /**
   * Fallback: parse article data from visible HTML.
   * SolanaFloor embeds article titles, categories, authors in the HTML.
   */
  private parseFromHTML(html: string): SolanaFloorArticle[] {
    const articles: SolanaFloorArticle[] = [];

    // Extract article links and titles from href patterns
    const linkPattern = /href="(\/(?:news|solana-news)\/[^"]+)"[^>]*>([^<]+)/gi;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(html)) !== null && articles.length < 20) {
      const url = `${this.baseUrl}${match[1]}`;
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

    // Also try to extract from JSON-LD structured data
    const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/gi;
    while ((match = jsonLdPattern.exec(html)) !== null && articles.length < 20) {
      try {
        const ld = JSON.parse(match[1]!);
        if (ld?.itemListElement) {
          for (const el of ld.itemListElement) {
            const item = el.item;
            if (item?.name && item?.url) {
              if (!articles.some((a) => a.url === item.url)) {
                articles.push({
                  title: item.name,
                  category: "News",
                  author: "SolanaFloor",
                  date: item.datePublished ?? new Date().toISOString(),
                  summary: item.description ?? "",
                  url: item.url,
                  image: item.image?.url,
                });
              }
            }
          }
        }
      } catch {
        /* ignore parse errors */
      }
    }

    return articles;
  }
}
