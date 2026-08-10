import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/project-history?slug=jupiter&days=30
 * Fetches real TVL history from DeFiLlama's free API.
 * Returns: { history: [{timestamp, tvl}], currentTvl, chainTvls }
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const days = parseInt(url.searchParams.get("days") ?? "30", 10);

    if (!slug) {
      return ok({ error: "Missing slug parameter", history: [] }, { status: 200 });
    }

    // DeFiLlama protocol endpoint — returns full TVL history
    const dlUrl = `https://api.llama.fi/protocol/${slug}`;
    const res = await fetch(dlUrl, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      return ok(
        { error: "DeFiLlama API unavailable", history: [], currentTvl: null, chainTvls: null },
        { status: 200 },
      );
    }

    const data = (await res.json()) as {
      tvl?: number;
      chainTvls?: Record<string, number>;
      tvlList?: Array<{ date: number; totalLiquidityUSD: number }>;
      name?: string;
      symbol?: string;
      logo?: string;
      url?: string;
      description?: string;
      category?: string;
      chains?: string[];
    };

    // Parse TVL history — DeFiLlama returns it in the protocol response
    const fullHistory = data.tvlList ?? [];
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const history = fullHistory
      .filter((d) => d.date * 1000 >= cutoff)
      .map((d) => ({
        timestamp: new Date(d.date * 1000).toISOString(),
        tvl: Math.round(d.totalLiquidityUSD),
      }));

    return ok({
      history,
      currentTvl: data.tvl ?? null,
      chainTvls: data.chainTvls ?? null,
      name: data.name,
      logo: data.logo,
      url: data.url,
      description: data.description,
      category: data.category,
      chains: data.chains,
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
