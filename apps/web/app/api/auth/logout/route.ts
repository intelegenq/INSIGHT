import { NextResponse } from "next/server";
import { getAuthService } from "../../../../lib/auth-service";
import { requestIdFromRequest } from "../../../../lib/api";
import { SESSION_COOKIE_NAME, sessionTokenFromRequest } from "../../../../lib/session";

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  const token = await sessionTokenFromRequest();
  if (token) getAuthService().logout(token);

  const response = NextResponse.json({ signedOut: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}