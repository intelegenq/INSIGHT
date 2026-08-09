import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const snapshots = await service.listSnapshots();
    return ok({ snapshots, count: snapshots.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const snapshot = await service.snapshot();
    return ok(
      { snapshot },
      { status: 201, headers: requestId ? { "x-request-id": requestId } : undefined },
    );
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
