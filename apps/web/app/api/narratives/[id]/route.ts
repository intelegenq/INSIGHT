import { getInsightService } from "../../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../lib/api";

/**
 * GET /api/narratives/[id] — narrative detail with linked projects and evidence.
 *
 * Returns a single narrative along with the full project and evidence
 * records referenced by its projectIds and evidenceIds.
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

    const narratives = await service.getNarratives();
    const narrative = narratives.find((n) => n.id === id);

    if (narrative === undefined) {
      return errorResponse("NOT_FOUND", `Narrative "${id}" not found.`, 404, undefined, requestId);
    }

    // Resolve linked projects
    const allProjects = await service.listProjects();
    const projectMap = new Map(allProjects.map((p) => [p.id, p]));
    const projects = narrative.projectIds
      .map((pid) => projectMap.get(pid))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    // Resolve linked evidence
    const evidence = await service.resolveEvidenceIds(narrative.evidenceIds);

    return ok({ narrative, projects, evidence });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
