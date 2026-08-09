import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * M29: POST /api/refresh — trigger a live data refresh cycle.
 * Executes the InsightService pipeline, producing a fresh snapshot.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const snapshot = service.snapshot();
    return ok(
      { snapshot, id: snapshot.id },
      { status: 201, headers: requestId ? { "x-request-id": requestId } : undefined },
    );
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
