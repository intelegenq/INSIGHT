import { getInsightService } from "../../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../lib/api";

/**
 * M45: GET /api/trends/overlay?ids=id1,id2,...
 *
 * Returns multi-project trend data for overlay comparison.
 * Each project gets a chronologically sorted array of trend points
 * with metrics and health scores.
 *
 * Min 2 IDs, max 10. Uses existing getMultiProjectTrend — no new data, no AI.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids") ?? "";
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length < 2) {
      return errorResponse(
        "VALIDATION_ERROR",
        "At least 2 project IDs are required for overlay comparison.",
        400,
        undefined,
        requestId,
      );
    }
    if (ids.length > 10) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Maximum 10 project IDs allowed for overlay comparison.",
        400,
        undefined,
        requestId,
      );
    }

    const service = getInsightService();
    await service.ready();
    const overlay = await service.getMultiProjectTrend(ids);

    return ok({
      projects: overlay,
      count: Object.keys(overlay).length,
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
