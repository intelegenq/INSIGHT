import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * GET /api/dashboard — aggregated dashboard data.
 *
 * Returns pulse metrics, timeline, top projects, and narratives in a
 * single response. Uses existing getPulse, getTimeline, listProjects,
 * and getNarratives — no new data sources, no AI.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    await service.ready();
    const [pulse, timeline, projects, narratives] = await Promise.all([
      service.getPulse(),
      service.getTimeline(),
      service.listProjects(),
      service.getNarratives(),
    ]);

    // Top projects by TVL (deterministic sort)
    const topProjects = [...projects]
      .sort((a, b) => (b.metrics.tvl ?? 0) - (a.metrics.tvl ?? 0))
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        tvl: p.metrics.tvl,
        volume24h: p.metrics.volume24h,
      }));

    return ok({
      pulse,
      timeline,
      projects: topProjects,
      narratives,
      asOf: pulse.asOf,
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
