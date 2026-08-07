import { getInsightService } from "../../../lib/insight-service";
import { errorResponse, getErrorMessage, ok } from "../../../lib/api";

/**
 * GET /api/history?from=<id>&to=<id>
 *
 * Compares two stored snapshots by id and returns a deterministic diff.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const fromId = url.searchParams.get("from");
    const toId = url.searchParams.get("to");

    if (fromId === null || fromId.length === 0 || toId === null || toId.length === 0) {
      return errorResponse(
        'Both "from" and "to" query parameters are required.',
        400,
        { received: { from: fromId, to: toId } },
      );
    }

    const service = getInsightService();
    const diff = service.compareSnapshots(fromId, toId);
    if (diff === undefined) {
      return errorResponse(
        `Unable to find both snapshots: from="${fromId}", to="${toId}".`,
        404,
      );
    }
    return ok({ diff });
  } catch (error) {
    return errorResponse(getErrorMessage(error), 500);
  }
}