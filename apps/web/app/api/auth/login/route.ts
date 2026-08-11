import { NextResponse } from "next/server";
import { getAuthService, publicUser } from "../../../../lib/auth-service";
import { errorFromUnknown, requestIdFromRequest } from "../../../../lib/api";
import { SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
    } | null;
    const email = body?.email ?? "";
    const password = body?.password ?? "";
    const { user, session } = getAuthService().login(email, password);
    const response = NextResponse.json({ user: publicUser(user) }, { status: 200 });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
    return response;
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
