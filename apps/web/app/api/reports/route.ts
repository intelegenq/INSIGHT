import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok } from "../../../lib/api";
import { validateReportLens, unwrapOrThrow } from "@insight/runtime";
import type { ReportLens } from "@insight/core";

const VALID_LENSES: readonly ReportLens[] = ["ecosystem", "defi", "infrastructure"];

/**
 * GET /api/reports?lens=ecosystem
 *
 * Returns the most recent generated report. The optional `lens` query
 * parameter selects which lens to read from the demo repository when no
 * snapshot is available.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawLens = url.searchParams.get("lens") ?? "ecosystem";
    const lensResult = validateReportLens(rawLens);
    if (!lensResult.ok) {
      return errorResponse("VALIDATION_ERROR", lensResult.error.message, 400, lensResult.error.details);
    }
    const lens = unwrapOrThrow(lensResult);
    const service = getInsightService();
    const report = service.getReport();
    if (report === undefined) {
      return errorResponse("NOT_FOUND", `No report available for lens \"${lens}\".`, 404);
    }
    return ok({ report, lens: report.lens });
  } catch (error) {
    return errorFromUnknown(error);
  }
}