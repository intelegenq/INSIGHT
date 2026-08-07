import { getInsightService } from "../../../lib/insight-service";
import { errorResponse, getErrorMessage, ok } from "../../../lib/api";
import type { ReportLens } from "@insight/core";

const VALID_LENSES: readonly ReportLens[] = ["ecosystem", "defi", "infrastructure"];

function isValidLens(value: string): value is ReportLens {
  return (VALID_LENSES as readonly string[]).includes(value);
}

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
    if (!isValidLens(rawLens)) {
      return errorResponse(
        `Invalid lens "${rawLens}". Expected one of: ${VALID_LENSES.join(", ")}.`,
        400,
        { received: rawLens, allowed: VALID_LENSES },
      );
    }
    const service = getInsightService();
    const report = service.getReport();
    if (report === undefined) {
      return errorResponse(`No report available for lens "${rawLens}".`, 404);
    }
    return ok({ report, lens: report.lens });
  } catch (error) {
    return errorResponse(getErrorMessage(error), 500);
  }
}