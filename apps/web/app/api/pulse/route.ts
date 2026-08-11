import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/pulse — ecosystem pulse dashboard data.
 * Derives pulse metrics + timeline from the live/snapshot pipeline.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const [pulse, rawTimeline] = await Promise.all([service.getPulse(), service.getTimeline()]);

    // Filter CEX entries from timeline
    const cexNames = ["binance","bybit","okx","bitfinex","gate","mexc","bitget","deribit","htx","coinbase","kraken","kucoin","bingx","poloniex","bitrue","crypto.com","upbit","wazirx","bitmart","bitmex","coinex","hotbit"];
    const timeline = (rawTimeline || []).filter((t: { title?: string }) =>
      !cexNames.some(c => (t.title || "").toLowerCase().includes(c))
    );

    return ok({ pulse, timeline });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
