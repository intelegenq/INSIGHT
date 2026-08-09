import { getAuthService, getSavedResearch } from "../../../lib/auth-service";
import { errorFromUnknown, ok, errorResponse, requestIdFromRequest } from "../../../lib/api";
import { userFromRequest } from "../../../lib/session";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const user = await userFromRequest(getAuthService());
    if (user === undefined)
      return errorResponse("UNAUTHORIZED", "Not authenticated.", 401, undefined, requestId);
    const saved = getSavedResearch(user.id);
    return ok({
      reports: saved.listReports(),
      narratives: saved.listNarratives(),
      projects: saved.listProjects(),
      sessions: saved.listSessions(),
      searches: saved.listSearches(),
      alerts: saved.listAlerts(),
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const user = await userFromRequest(getAuthService());
    if (user === undefined)
      return errorResponse("UNAUTHORIZED", "Not authenticated.", 401, undefined, requestId);
    const body = (await request.json().catch(() => null)) as {
      kind?: "report" | "narrative" | "project" | "session" | "search" | "alert";
      reportId?: string;
      lens?: string;
      title?: string;
      narrativeId?: string;
      projectId?: string;
      name?: string;
      query?: string;
      alert?: {
        targetType?: "project" | "narrative";
        targetId?: string;
        targetName?: string;
        condition?: string;
        threshold?: number;
      };
      session?: { title?: string; lens?: string; reportId?: string };
    } | null;

    if (!body?.kind)
      return errorResponse("VALIDATION_ERROR", "Missing 'kind'.", 400, undefined, requestId);

    switch (body.kind) {
      case "report":
        if (!body.reportId || !body.lens)
          return errorResponse(
            "VALIDATION_ERROR",
            "reportId and lens are required.",
            400,
            undefined,
            requestId,
          );
        return ok({
          report: getSavedResearch(user.id).saveReport(
            body.reportId,
            body.lens as never,
            body.title ?? "Report",
          ),
        });
      case "narrative":
        if (!body.narrativeId)
          return errorResponse(
            "VALIDATION_ERROR",
            "narrativeId is required.",
            400,
            undefined,
            requestId,
          );
        return ok({
          narrative: getSavedResearch(user.id).saveNarrative(
            body.narrativeId,
            body.name ?? "Untitled",
          ),
        });
      case "project":
        if (!body.projectId)
          return errorResponse(
            "VALIDATION_ERROR",
            "projectId is required.",
            400,
            undefined,
            requestId,
          );
        return ok({
          project: getSavedResearch(user.id).saveProject(body.projectId, body.name ?? "Untitled"),
        });
      case "session":
        if (!body.session?.title || !body.session.lens)
          return errorResponse(
            "VALIDATION_ERROR",
            "Session title and lens are required.",
            400,
            undefined,
            requestId,
          );
        return ok({
          session: getSavedResearch(user.id).createSession({
            title: body.session.title,
            lens: body.session.lens as never,
            reportId: body.session.reportId,
          }),
        });
      case "search":
        if (!body.query)
          return errorResponse("VALIDATION_ERROR", "query is required.", 400, undefined, requestId);
        return ok({ search: getSavedResearch(user.id).saveSearch(body.query, body.name) });
      case "alert":
        if (!body.alert?.targetType || !body.alert?.targetId || !body.alert?.condition)
          return errorResponse(
            "VALIDATION_ERROR",
            "alert.targetType, alert.targetId, and alert.condition are required.",
            400,
            undefined,
            requestId,
          );
        return ok({
          alert: getSavedResearch(user.id).createAlert({
            targetType: body.alert.targetType,
            targetId: body.alert.targetId,
            targetName: body.alert.targetName ?? body.alert.targetId,
            condition: body.alert.condition as never,
            threshold: body.alert.threshold,
          }),
        });
      default:
        return errorResponse(
          "VALIDATION_ERROR",
          `Unknown kind: ${body.kind}`,
          400,
          undefined,
          requestId,
        );
    }
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const user = await userFromRequest(getAuthService());
    if (user === undefined)
      return errorResponse("UNAUTHORIZED", "Not authenticated.", 401, undefined, requestId);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    if (!kind || !id)
      return errorResponse(
        "VALIDATION_ERROR",
        "kind and id are required.",
        400,
        undefined,
        requestId,
      );

    const saved = getSavedResearch(user.id);
    let removed = false;
    switch (kind) {
      case "report":
        removed = saved.removeReport(id);
        break;
      case "narrative":
        removed = saved.removeNarrative(id);
        break;
      case "project":
        removed = saved.removeProject(id);
        break;
      case "session":
        removed = saved.removeSession(id);
        break;
      case "search":
        removed = saved.removeSearch(id);
        break;
      case "alert":
        removed = saved.removeAlert(id);
        break;
      default:
        return errorResponse(
          "VALIDATION_ERROR",
          `Unknown kind: ${kind}`,
          400,
          undefined,
          requestId,
        );
    }
    return ok({ removed });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
