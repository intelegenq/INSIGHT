import { getAuthService, publicUser } from "../../../../lib/auth-service";
import { errorFromUnknown, ok, errorResponse, requestIdFromRequest } from "../../../../lib/api";
import { userFromRequest } from "../../../../lib/session";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const user = await userFromRequest(getAuthService());
    if (user === undefined)
      return errorResponse("UNAUTHORIZED", "Not authenticated.", 401, undefined, requestId);
    return ok({ user: publicUser(user) });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}