import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../lib/api";
import { validateReportLens } from "@insight/runtime";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const rawLens = url.searchParams.get("lens") ?? "ecosystem";
    const lensResult = validateReportLens(rawLens);
    if (!lensResult.ok)
      return errorResponse(
        "VALIDATION_ERROR",
        lensResult.error.message,
        400,
        lensResult.error.details,
        requestId,
      );
    const report = await getInsightService().getReport(lensResult.value);
    if (report === undefined)
      return errorResponse(
        "NOT_FOUND",
        `No report available for lens "${lensResult.value}".`,
        404,
        undefined,
        requestId,
      );
    return ok({ report, lens: report.lens });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
