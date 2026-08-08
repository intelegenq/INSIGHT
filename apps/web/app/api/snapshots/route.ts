import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

async function getSnapshots(request?: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const snapshots = service.listSnapshots();
    return ok({ snapshots, count: snapshots.length });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

async function createSnapshot(request?: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const snapshot = service.snapshot();
    return ok(
      { snapshot },
      { status: 201, headers: requestId ? { "x-request-id": requestId } : undefined },
    );
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

export const GET: (request: Request) => Promise<Response> = getSnapshots;
export const POST: (request: Request) => Promise<Response> = createSnapshot;
