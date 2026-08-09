import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

export function GET(): Promise<Response>;
export function GET(request: Request): Promise<Response>;
export async function GET(request?: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const projects = await service.listProjects();
    return ok({ projects, count: projects.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
