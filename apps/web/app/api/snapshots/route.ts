import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok } from "../../../lib/api";

/**
 * GET /api/snapshots
 * Returns every stored snapshot in insertion order.
 *
 * POST /api/snapshots
 * Captures a new snapshot from the current runtime pipeline and stores it.
 */
export async function GET(): Promise<Response> {
  try {
    const service = getInsightService();
    const snapshots = service.listSnapshots();
    return ok({ snapshots, count: snapshots.length });
  } catch (error) {
    return errorFromUnknown(error);
  }
}

export async function POST(): Promise<Response> {
  try {
    const service = getInsightService();
    const snapshot = service.snapshot();
    return ok({ snapshot }, { status: 201 });
  } catch (error) {
    return errorFromUnknown(error);
  }
}