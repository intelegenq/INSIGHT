import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok } from "../../../lib/api";

/**
 * GET /api/projects
 *
 * Returns the list of projects from the latest runtime snapshot, falling
 * back to the demo repository when no snapshot has been captured.
 */
export async function GET(): Promise<Response> {
  try {
    const service = getInsightService();
    const projects = service.listProjects();
    return ok({ projects, count: projects.length });
  } catch (error) {
    return errorFromUnknown(error);
  }
}