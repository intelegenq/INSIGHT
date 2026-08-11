import { ok } from "../../../lib/api";

/**
 * GET /api/etf-flows — fetch Solana ETF flow data from SolanaFloor.
 * Scrapes https://solanafloor.com/etf-tracker for ETF flow information.
 * Parses Next.js RSC stream chunks for structured ETF data.
 */
export async function GET(): Promise<Response> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://solanafloor.com/etf-tracker", {
      signal: controller.signal,
      next: { revalidate: 1800 },
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
  date: string;
  netFlow: number;
}

interface EtfData {
  name: string;
  ticker: string;
  staking: boolean;
  aum: number | null;
  flows: EtfFlow[];
  url?: string;
}

function parseEtfData(html: string): EtfData[] {
  const etfs: EtfData[] = [];

  // Extract all RSC stream chunks
  const chunkPattern = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
  const chunks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = chunkPattern.exec(html)) !== null) {
    try {
      // Decode unicode escapes
      const decoded = match[1]!
        .replace(/\\u00([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      chunks.push(decoded);
    } catch {
      // skip
    }
  }

  // Search for solanaEtfs data in chunks
  const etfPattern = /"solanaEtfs":\[(\[?\{[^\]]+)\]/;
  for (const chunk of chunks) {
    const etfMatch = chunk.match(/"solanaEtfs":\[(.+?)\]\s*\}/);
    if (etfMatch) {
      // Extract the ETF array — it's JSON-like but may have RSC escapes
      const rawArray = etfMatch[1]!;
      // Try to parse individual ETF objects
      const objPattern =
        /\{"id":"[^"]+","ticker":"([^"]+)","staking":(true|false),"name":"([^"]+)","current_aum":(\d+),"solana_etf_flows":\[(.*?)\]\}/g;
      let objMatch: RegExpExecArray | null;
      while ((objMatch = objPattern.exec(rawArray)) !== null) {
        const ticker = objMatch[1]!;
        const staking = objMatch[2] === "true";
        const name = objMatch[3]!;
        const aum = parseInt(objMatch[4]!, 10);
        const flowsRaw = objMatch[5]!;

        // Parse flows
        const flows: EtfFlow[] = [];
        const flowPattern = /\{"date":"([^"]+)","net_flow_value":(-?\d+(?:\.\d+)?)\}/g;
        let flowMatch: RegExpExecArray | null;
        while ((flowMatch = flowPattern.exec(flowsRaw)) !== null) {
          flows.push({
            date: flowMatch[1]!,
            netFlow: parseFloat(flowMatch[2]!),
          });
        }

        if (!etfs.some((e) => e.ticker === ticker)) {
          etfs.push({
            name,
            ticker,
            staking,
            aum: aum || null,
            flows,
            url: `https://solanafloor.com/etf-tracker`,
          });
        }
      }
    }
  }

  // Also try simpler pattern — search for ticker/name/aum pairs
  if (etfs.length === 0) {
    const tickerPattern =
      /"ticker":"([A-Z]+)","staking":(true|false),"name":"([^"]+)","current_aum":(\d+)/g;
    for (const chunk of chunks) {
      let m: RegExpExecArray | null;
      while ((m = tickerPattern.exec(chunk)) !== null) {
        if (!etfs.some((e) => e.ticker === m![1])) {
          etfs.push({
            ticker: m![1]!,
            staking: m![2] === "true",
            name: m![3]!,
            aum: parseInt(m![4]!, 10) || null,
            flows: [],
          });
        }
      }
    }
  }

  return etfs;
}
