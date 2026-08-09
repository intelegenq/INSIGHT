import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/compare?ids=id1,id2,id3 — cross-project comparison.
 *
 * Returns each project's metrics, health scores, and evidence count
 * in a uniform shape for side-by-side comparison.
 *
 * Deterministic: uses existing listProjects, getProjectHealth, and
 * resolveEvidenceIds — no external service, no AI, no new data.
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
        "At least 2 project IDs are required. Usage: /api/compare?ids=id1,id2",
        400,
        { received: ids.length },
        requestId,
      );
    }

    if (ids.length > 10) {
      return errorResponse(
        "VALIDATION_ERROR",
        "A maximum of 10 projects can be compared at once.",
        400,
        { received: ids.length },
        requestId,
      );
    }

    const entries = await getInsightService().compareProjects(ids);

    if (entries.length === 0) {
      return errorResponse(
        "NOT_FOUND",
        "None of the specified project IDs were found.",
        404,
        undefined,
        requestId,
      );
    }

    const notFound = ids.filter((id) => !entries.some((e) => e.id === id));

    return ok({
      entries,
      count: entries.length,
      ...(notFound.length > 0 ? { notFound } : {}),
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
