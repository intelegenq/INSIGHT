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

/**
 * Build a structured error response.
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
  requestId?: string,
): Response {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(requestId !== undefined ? { requestId } : {}),
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  );
}

export function errorFromUnknown(error: unknown, requestId?: string): Response {
  const normalized = normalizeError(error);
  const status = normalized.code === "NOT_FOUND" ? 404 : 500;
  const message = normalized.code === "INTERNAL_ERROR" ? "An unexpected error occurred." : normalized.message;
  return errorResponse(normalized.code, message, status, normalized.details, requestId);
}

export function errorFromInsightError(error: InsightError, requestId?: string): Response {
  const status = error.code === "NOT_FOUND" ? 404 : 400;
  return errorResponse(error.code, error.message, status, error.details, requestId);
}

/** Type guard for unknown thrown values. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof InsightError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}