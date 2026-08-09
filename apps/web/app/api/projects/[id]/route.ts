import { getInsightService } from "../../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../lib/api";
import { projectRepository } from "@insight/data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const { id } = await params;
    const service = getInsightService();
    const projects = await service.listProjects();
    const project = projects.find((p) => p.id === id);
    if (project === undefined)
      return errorResponse("NOT_FOUND", `Project "${id}" not found.`, 404, undefined, requestId);
    // Resolve evidence IDs for the project's evidence log
    const evidence = projectRepository.resolveEvidenceIds(project.evidenceIds);
    return ok({ project, evidence });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
