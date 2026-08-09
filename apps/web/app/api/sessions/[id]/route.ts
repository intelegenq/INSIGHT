import { getAuthService, getSavedResearch } from "../../../../lib/auth-service";
import { errorFromUnknown, ok, errorResponse, requestIdFromRequest } from "../../../../lib/api";
import { userFromRequest } from "../../../../lib/session";

/**
 * M47: GET /api/sessions/[id] — get a single research session with resolved project/narrative names.
 * PATCH /api/sessions/[id] — add or remove projects/narratives from a session.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const user = await userFromRequest(getAuthService());
    if (user === undefined)
      return errorResponse("UNAUTHORIZED", "Not authenticated.", 401, undefined, requestId);
    const { id } = await params;
    const saved = getSavedResearch(user.id);
    const session = saved.getSession(id);
    if (!session)
      return errorResponse("NOT_FOUND", `Session "${id}" not found.`, 404, undefined, requestId);
    return ok({ session });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const user = await userFromRequest(getAuthService());
    if (user === undefined)
      return errorResponse("UNAUTHORIZED", "Not authenticated.", 401, undefined, requestId);
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      action?: "addProject" | "removeProject" | "addNarrative" | "removeNarrative";
      projectId?: string;
      narrativeId?: string;
    } | null;

    if (!body?.action)
      return errorResponse("VALIDATION_ERROR", "Missing 'action'.", 400, undefined, requestId);

    const saved = getSavedResearch(user.id);
    let session;
    switch (body.action) {
      case "addProject":
        if (!body.projectId)
          return errorResponse(
            "VALIDATION_ERROR",
            "projectId is required.",
            400,
            undefined,
            requestId,
          );
        session = saved.addProjectToSession(id, body.projectId);
        break;
      case "removeProject":
        if (!body.projectId)
          return errorResponse(
            "VALIDATION_ERROR",
            "projectId is required.",
            400,
            undefined,
            requestId,
          );
        session = saved.removeProjectFromSession(id, body.projectId);
        break;
      case "addNarrative":
        if (!body.narrativeId)
          return errorResponse(
            "VALIDATION_ERROR",
            "narrativeId is required.",
            400,
            undefined,
            requestId,
          );
        session = saved.addNarrativeToSession(id, body.narrativeId);
        break;
      case "removeNarrative":
        if (!body.narrativeId)
          return errorResponse(
            "VALIDATION_ERROR",
            "narrativeId is required.",
            400,
            undefined,
            requestId,
          );
        session = saved.removeNarrativeFromSession(id, body.narrativeId);
        break;
      default:
        return errorResponse(
          "VALIDATION_ERROR",
          `Unknown action: ${body.action}`,
          400,
          undefined,
          requestId,
        );
    }

    if (!session)
      return errorResponse("NOT_FOUND", `Session "${id}" not found.`, 404, undefined, requestId);
    return ok({ session });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
