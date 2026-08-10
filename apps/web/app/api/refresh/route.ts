import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";

/**
 * M29: POST /api/refresh — trigger a live data refresh cycle.
 * GET /api/refresh — Vercel cron trigger (same behavior).
 * Executes the InsightService pipeline, producing a fresh snapshot
 * persisted to the configured snapshot repository (Postgres in production,
 * in-memory in dev/test).
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    const snapshot = await service.snapshot();
    return ok(
      { snapshot, id: snapshot.id },
      { status: 201, headers: requestId ? { "x-request-id": requestId } : undefined },
    );
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

export async function GET(): Promise<Response> {
  try {
    const service = getInsightService();
    const snapshot = await service.snapshot();
    return ok({ ok: true, id: snapshot.id, timestamp: snapshot.referenceDate });
  } catch (error) {
    return ok({ ok: false, error: error instanceof Error ? error.message : "unknown" });
  }
}
