import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/search?q=<query> — global search across Insight data.
 *
 * Searches projects, narratives, and evidence deterministically — no external
 * search service, no AI, no web search. Results are sorted by relevance tier:
 * exact name match > name starts-with > name/description contains.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";

    if (q.trim().length === 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        'Query parameter "q" must be a non-empty string.',
        400,
        undefined,
        requestId,
      );
    }

    const results = await getInsightService().search(q);
    return ok(results);
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
