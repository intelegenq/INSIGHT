import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/solana-price?days=30
 * Fetches real SOL price history from CoinGecko's free API.
 * Returns: { prices: [{timestamp, price}], marketCaps: [{timestamp, value}], volumes: [{timestamp, value}], current: {price, marketCap, volume, change24h, change7d, change30d} }
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const days = url.searchParams.get("days") ?? "30";

    const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=${days}`;
    const marketsUrl =
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=solana&price_change_percentage=24h,7d,30d";

    const [chartRes, marketsRes] = await Promise.all([
      fetch(coingeckoUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(marketsUrl, { signal: AbortSignal.timeout(8000) }),
    ]);

    if (!chartRes.ok || !marketsRes.ok) {
      return ok(
        {
          error: "CoinGecko API unavailable",
          prices: [],
          marketCaps: [],
          volumes: [],
          current: null,
        },
        { status: 200 },
      );
    }

    const chart = (await chartRes.json()) as {
      prices: [number, number][];
      market_caps: [number, number][];
      total_volumes: [number, number][];
    };

    const markets = (await marketsRes.json()) as Array<{
      current_price: number;
      market_cap: number;
      total_volume: number;
      price_change_percentage_24h?: number;
      price_change_percentage_7d_in_currency?: number;
      price_change_percentage_30d_in_currency?: number;
      circulating_supply: number;
      high_24h: number;
      low_24h: number;
    }>;

    const m = markets[0];
    const prices = (chart.prices ?? []).map(([ts, price]) => ({
      timestamp: new Date(ts).toISOString(),
      price: Math.round(price * 100) / 100,
    }));
    const marketCaps = (chart.market_caps ?? []).map(([ts, val]) => ({
      timestamp: new Date(ts).toISOString(),
      value: Math.round(val),
    }));
    const volumes = (chart.total_volumes ?? []).map(([ts, val]) => ({
      timestamp: new Date(ts).toISOString(),
      value: Math.round(val),
    }));

    return ok({
      prices,
      marketCaps,
      volumes,
      current: m
        ? {
            price: m.current_price,
            marketCap: m.market_cap,
            volume: m.total_volume,
            change24h: m.price_change_percentage_24h,
            change7d: m.price_change_percentage_7d_in_currency,
            change30d: m.price_change_percentage_30d_in_currency,
            circulatingSupply: m.circulating_supply,
            high24h: m.high_24h,
            low24h: m.low_24h,
          }
        : null,
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
