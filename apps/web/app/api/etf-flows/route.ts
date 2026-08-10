import { ok } from "../../../lib/api";

/**
 * GET /api/etf-flows — fetch Solana ETF flow data from SolanaFloor.
 * Scrapes https://solanafloor.com/etf-tracker for ETF flow information.
 * If unavailable, returns empty with honest "unavailable" status.
 */
export async function GET(): Promise<Response> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://solanafloor.com/etf-tracker", {
      signal: controller.signal,
      headers: { "User-Agent": "InsightBot/1.0 (+https://insight-web-six.vercel.app)" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return ok({ etfs: [], error: "ETF tracker unavailable" });
    }

    const html = await res.text();
    const etfs = parseEtfData(html);

    return ok({
      etfs,
      count: etfs.length,
      source: "SolanaFloor ETF Tracker",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return ok({ etfs: [], error: error instanceof Error ? error.message : "unknown" });
  }
}

interface EtfFlow {
  name: string;
  ticker: string;
  dailyFlow?: number;
  totalNetFlow?: number;
  aum?: number;
  url?: string;
}

function parseEtfData(html: string): EtfFlow[] {
  const etfs: EtfFlow[] = [];

  // Try __NEXT_DATA__ JSON
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]!);
      const props = data?.props?.pageProps ?? {};
      const items = props.etfs ?? props.etfData ?? props.items ?? [];

      for (const item of items) {
        if (!item?.name && !item?.ticker) continue;
        etfs.push({
          name: item.name ?? item.etf_name ?? "Unknown",
          ticker: item.ticker ?? item.symbol ?? "",
          dailyFlow: item.dailyFlow ?? item.daily_flow,
          totalNetFlow: item.totalNetFlow ?? item.total_net_flow ?? item.net_flow,
          aum: item.aum ?? item.assets_under_management,
          url: item.slug ? `https://solanafloor.com${item.slug}` : item.url,
        });
      }
    } catch {
      /* fall through */
    }
  }

  // Fallback: extract ETF tickers/names from HTML text
  if (etfs.length === 0) {
    // Look for ETF-related data patterns
    const tickerPattern = /"ticker":"([A-Z]+)"/g;
    const namePattern = /"name":"([^"]+)"/g;
    const tickers: string[] = [];
    const names: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tickerPattern.exec(html)) !== null) tickers.push(m[1]!);
    while ((m = namePattern.exec(html)) !== null) names.push(m[1]!);

    for (let i = 0; i < Math.min(tickers.length, names.length, 10); i++) {
      if (!etfs.some((e) => e.ticker === tickers[i])) {
        etfs.push({
          name: names[i]!,
          ticker: tickers[i]!,
        });
      }
    }
  }

  return etfs;
}
