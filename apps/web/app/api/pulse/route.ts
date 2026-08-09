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
    const [pulse, timeline] = await Promise.all([service.getPulse(), service.getTimeline()]);
    return ok({ pulse, timeline });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
