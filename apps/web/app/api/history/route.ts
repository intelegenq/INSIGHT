import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../lib/api";
import { validateSnapshotId } from "@insight/runtime";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const fromId = url.searchParams.get("from");
    const toId = url.searchParams.get("to");
    if (fromId === null || toId === null) {
      return errorResponse(
        "VALIDATION_ERROR",
        'Both "from" and "to" query parameters are required.',
        400,
        { received: { from: fromId, to: toId } },
        requestId,
      );
    }
    const fromResult = validateSnapshotId(fromId);
    if (!fromResult.ok)
      return errorResponse(
        "VALIDATION_ERROR",
        fromResult.error.message,
        400,
        fromResult.error.details,
        requestId,
      );
    const toResult = validateSnapshotId(toId);
    if (!toResult.ok)
      return errorResponse(
        "VALIDATION_ERROR",
        toResult.error.message,
        400,
        toResult.error.details,
        requestId,
      );
    const diff = getInsightService().compareSnapshots(fromResult.value, toResult.value);
    return ok({ diff });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
