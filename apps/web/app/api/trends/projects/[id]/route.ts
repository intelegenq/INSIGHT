import { getInsightService } from "../../../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../../lib/api";

/**
 * GET /api/trends/projects/[id] — project trend across all snapshots.
 *
 * Returns an array of trend points, each containing the snapshot ID,
 * reference date, project metrics, and health scores at that point in
 * time. Points are sorted chronologically.
 *
 * Uses existing listSnapshots and scoreProject — no new data, no AI.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const { id } = await params;
    const service = getInsightService();
    await service.ready();
    const trend = await service.getProjectTrend(id);

    if (trend.length === 0) {
      return errorResponse(
        "NOT_FOUND",
        `No trend data for project "${id}". The project may not exist or no snapshots contain it.`,
        404,
        undefined,
        requestId,
      );
    }

    // Resolve project name from current data for display
    const projects = await service.listProjects();
    const project = projects.find((p) => p.id === id);
    const name = project?.name ?? id;
    const category = project?.category ?? "unknown";

    return ok({
      projectId: id,
      name,
      category,
      points: trend,
      count: trend.length,
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
