import { getInsightService } from "../../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../lib/api";
import { validateReportLens } from "@insight/runtime";

/**
 * GET /api/reports/evaluated?lens=ecosystem — get a report with quality verdict.
 *
 * Exposes the M30 evaluation infrastructure (evaluateReport/evaluateEvidence)
 * through the API. Returns the report plus the ReportVerdict with quality,
 * evidence stats, and verified-evidence flag.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const rawLens = url.searchParams.get("lens") ?? "ecosystem";
    const lensResult = validateReportLens(rawLens);
    if (!lensResult.ok) {
      return errorResponse(
        "VALIDATION_ERROR",
        lensResult.error.message,
        400,
        lensResult.error.details,
        requestId,
      );
    }
    const service = getInsightService();
    await service.ready();
    const evaluated = await service.getEvaluatedReport(lensResult.value);
    if (evaluated === undefined) {
      return errorResponse(
        "NOT_FOUND",
        `No report available for lens "${lensResult.value}".`,
        404,
        undefined,
        requestId,
      );
    }
    return ok(evaluated);
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
