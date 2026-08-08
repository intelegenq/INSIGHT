import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok } from "../../../lib/api";
import { validateSnapshotId } from "@insight/runtime";

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

    if (fromId === null || toId === null) {
      return errorResponse("VALIDATION_ERROR", 'Both "from" and "to" query parameters are required.', 400, { received: { from: fromId, to: toId } });
    }
    const fromResult = validateSnapshotId(fromId);
    if (!fromResult.ok) {
      return errorResponse("VALIDATION_ERROR", fromResult.error.message, 400, fromResult.error.details);
    }
    const toResult = validateSnapshotId(toId);
    if (!toResult.ok) {
      return errorResponse("VALIDATION_ERROR", toResult.error.message, 400, toResult.error.details);
    }

    const service = getInsightService();
    const diff = service.compareSnapshots(fromResult.value, toResult.value);
    if (diff === undefined) {
      return errorResponse("NOT_FOUND", `Unable to compare snapshots: from=\"${fromResult.value}\", to=\"${toResult.value}\".`, 404);
    }
    return ok({ diff });
  } catch (error) {
    return errorFromUnknown(error);
  }
}