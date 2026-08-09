import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";
import { projectRepository } from "@insight/data";

/**
 * GET /api/pulse — ecosystem pulse dashboard data.
 * Returns pulse metrics + timeline from the current repository.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const pulse = projectRepository.getPulse();
    const timeline = projectRepository.getTimeline();
    return ok({ pulse, timeline });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
