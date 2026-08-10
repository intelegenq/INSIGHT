import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/evidence — list all evidence items or resolve specific IDs.
 * Without ?ids=, returns all evidence from the current snapshot.
 * With ?ids=id1,id2,id3, resolves those specific evidence IDs.
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

    if (ids.length > 0) {
      const evidence = await getInsightService().resolveEvidenceIds(ids);
      return ok({ evidence, count: evidence.length });
    }

    // No IDs specified — return all evidence from the evidence timeline
    const service = getInsightService();
    await service.ready();
    const timeline = await service.getEvidenceTimeline();
    const evidence = timeline.map((item) => item.evidence);
    return ok({ evidence, count: evidence.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
