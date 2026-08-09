import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/health — source health monitoring.
 *
 * Returns the health status of all configured data providers.
 * Uses the existing SourceHealthMonitor from @insight/data.
 *
 * Response: { status, checkedAt, providers, summary }
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    await service.ready();
    const report = await service.checkSourceHealth();
    return ok(report);
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
