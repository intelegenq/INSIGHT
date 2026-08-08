/**
 * M25 — Session helpers for the web app.
 *
 * Uses an HTTP-only cookie to hold the session token. Route handlers resolve
 * the token from cookies(); page components await the same helper.
 */
import { cookies } from "next/headers";
import type { AuthenticationService } from "@insight/data/auth";
import type { AuthValidationError } from "@insight/data/auth";
import type { User } from "@insight/core";

export const SESSION_COOKIE_NAME = "insight_session";

/**
 * Resolve the session token from the request cookie store.
 * Next.js 15: cookies() is async.
 */
export async function sessionTokenFromRequest(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token ? token : undefined;
}

/** Resolve the authenticated user (or undefined) for the current request. */
export async function userFromRequest(
  service: AuthenticationService,
): Promise<User | undefined> {
  const token = await sessionTokenFromRequest();
  if (!token) return undefined;
  return service.getUserForSession(token);
}

/** Extract a bearer token from an Authorization header (alternative transport). */
export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ? match[1].trim() : undefined;
}

/** Classify an auth validation error into a stable HTTP status. */
export function authErrorStatus(error: AuthValidationError): number {
  return error.code === "VALIDATION_ERROR" ? 400 : 500;
}