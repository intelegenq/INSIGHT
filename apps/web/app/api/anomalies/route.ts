import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";
import { detectAnomalies, detectEvidenceAnomalies } from "@insight/intelligence";
import type { Anomaly } from "@insight/intelligence";

/**
 * GET /api/anomalies — detect ecosystem anomalies from recent snapshot diffs.
 *
 * Compares the two most recent snapshots and returns detected anomalies:
 * - TVL drops/rises
 * - Volume drops/rises
 * - Narrative trend shifts
 * - Validator delinquency spikes
 * - TPS anomalies
 * - SOL price moves
 *
 * Uses existing snapshot comparison and evidence — no new data, no AI.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const service = getInsightService();
    await service.ready();

    const snapshots = await service.listSnapshots();
    if (snapshots.length < 2) {
      return ok({
        anomalies: [],
        count: 0,
        message: "Need at least 2 snapshots for anomaly detection.",
      });
    }

    // Compare the two most recent snapshots
    const sorted = [...snapshots].sort(
      (a, b) => new Date(b.referenceDate).getTime() - new Date(a.referenceDate).getTime(),
    );
    const latest = sorted[0]!;
    const previous = sorted[1]!;

    // Get snapshot diff
    const diff = await service.compareSnapshots(previous.id, latest.id);
    const diffAnomalies = detectAnomalies(diff as never);

    // Evidence-based anomaly detection (validator, TPS, price)
    const latestEvidence = latest.evidence;
    const previousEvidence = previous.evidence;
    const evidenceAnomalies = detectEvidenceAnomalies(latestEvidence, previousEvidence);

    // Combine and sort by severity (highest first)
    const allAnomalies: Anomaly[] = [...diffAnomalies, ...evidenceAnomalies].sort(
      (a, b) => b.severity - a.severity,
    );

    return ok({
      anomalies: allAnomalies,
      count: allAnomalies.length,
      fromSnapshot: previous.id,
      toSnapshot: latest.id,
      fromDate: previous.referenceDate,
      toDate: latest.referenceDate,
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
