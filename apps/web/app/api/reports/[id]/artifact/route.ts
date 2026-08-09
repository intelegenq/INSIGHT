import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../../lib/api";

/**
 * GET /api/reports/[id]/artifact — retrieve a report artifact from ObjectStore.
 *
 * Returns the stored report JSON artifact (persisted by InsightService.getReport
 * via getSharedObjectStore).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const { id } = await params;
    if (!id || id.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "Report ID is required.", 400, undefined, requestId);
    }

    const { getSharedObjectStore } = await import("@insight/infra");
    const objectStore = await getSharedObjectStore();
    const key = `reports/${id}.json`;
    const body = await objectStore.get(key);

    if (body === undefined) {
      return errorResponse(
        "NOT_FOUND",
        `No stored artifact for report "${id}".`,
        404,
        undefined,
        requestId,
      );
    }

    const text = new TextDecoder().decode(body);
    return ok({ reportId: id, artifact: JSON.parse(text) });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
