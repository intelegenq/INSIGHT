/**
 * Tiny JSON helpers for API route handlers.
 */

import { NextResponse } from "next/server";
import { InsightError, normalizeError } from "@insight/runtime";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json(data, { status: 200, ...init });
}

export function requestIdFromRequest(request: Request): string | undefined {
  const value = request.headers.get("x-request-id")?.trim();
  return value ? value.slice(0, 128) : undefined;
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
  requestId?: string,
): Response {
  return NextResponse.json(
    { error: { code, message, ...(requestId !== undefined ? { requestId } : {}), ...(details !== undefined ? { details } : {}) } },
    { status, headers: requestId ? { "x-request-id": requestId } : undefined },
  );
}

function statusForCode(code: string): number {
  if (code === "NOT_FOUND" || code === "SNAPSHOT_NOT_FOUND") return 404;
  if (code === "INVALID_INPUT" || code === "VALIDATION_ERROR" || code === "SNAPSHOT_INTEGRITY_ERROR") return 400;
  if (code === "PROVIDER_TIMEOUT") return 504;
  if (code === "PROVIDER_ERROR") return 502;
  return 500;
}

export function errorFromUnknown(error: unknown, requestId?: string): Response {
  const normalized = normalizeError(error);
  const message = normalized.code === "INTERNAL_ERROR" ? "An unexpected error occurred." : normalized.message;
  return errorResponse(normalized.code, message, statusForCode(normalized.code), normalized.details, requestId);
}

export function errorFromInsightError(error: InsightError, requestId?: string): Response {
  return errorResponse(error.code, error.message, statusForCode(error.code), error.details, requestId);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof InsightError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
