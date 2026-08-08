import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

async function getProjects(request?: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const projects = service.listProjects();
    return ok({ projects, count: projects.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

export const GET: (request: Request) => Promise<Response> = getProjects;
