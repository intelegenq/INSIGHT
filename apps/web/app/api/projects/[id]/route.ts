import { getInsightService } from "../../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const { id } = await params;
    const service = getInsightService();
    const projects = service.listProjects();
    const project = projects.find((p) => p.id === id);
    if (project === undefined)
      return errorResponse("NOT_FOUND", `Project "${id}" not found.`, 404, undefined, requestId);
    return ok({ project });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
