import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const result = service.run();
    return ok({ narratives: result.narratives, count: result.narratives.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
