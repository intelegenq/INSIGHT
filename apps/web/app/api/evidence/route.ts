import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/evidence?ids=id1,id2,id3 — resolve evidence IDs to full evidence records.
 * Routes through the live/snapshot pipeline — no direct projectRepository bypass.
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
    const evidence = await getInsightService().resolveEvidenceIds(ids);
    return ok({ evidence, count: evidence.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
