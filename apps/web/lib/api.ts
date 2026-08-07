/**
 * Tiny JSON helpers for API route handlers.
 */

import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json(data, { status: 200, ...init });
}

/**
 * Build a structured error response.
 */
export function errorResponse(
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return NextResponse.json(
    {
      error: {
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  );
}

/** Type guard for unknown thrown values. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}