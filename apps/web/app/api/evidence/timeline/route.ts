import { getInsightService } from "../../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../../lib/api";

/**
 * M46: GET /api/evidence/timeline — chronological evidence from all snapshots.
 *
 * Returns all evidence deduplicated by ID, sorted by observedAt descending.
 * Each evidence entry includes associated project and narrative IDs.
 *
 * Query params (all optional):
 *   status   — filter by evidence status (demo/verified/pending/draft)
 *   sourceId — filter by evidence source ID
 *   projectId — filter to evidence linked to a specific project
 *
 * Uses existing snapshotRepository.list() — no new data, no AI.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const sourceId = url.searchParams.get("sourceId") ?? undefined;
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const service = getInsightService();
    await service.ready();
    const timeline = await service.getEvidenceTimeline({
      status: status ?? undefined,
      sourceId: sourceId ?? undefined,
      projectId: projectId ?? undefined,
    });

    return ok({
      evidence: timeline,
      count: timeline.length,
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
