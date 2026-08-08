/**
 * @insight/runtime/errors — Structured runtime error model.
 *
 * Provides a framework-independent error model with:
 * - Stable machine-readable error codes
 * - Human-readable messages
 * - Optional details (sanitized)
 * - Optional cause (internal only)
 * - Retryable classification
 * - Safe serialization (no secrets, no stack traces, no provider internals)
 */

/**
 * Stable error codes — finite set based on existing architecture.
 * Codes are machine-readable and never change.
 */
export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR"
  | "PROVIDER_TIMEOUT"
  | "SNAPSHOT_NOT_FOUND"
  | "SNAPSHOT_INTEGRITY_ERROR"
  | "EXECUTION_FAILED"
  | "INTERNAL_ERROR";

/**
 * Error code categories for grouping and retry logic.
 */
export const ErrorCodeCategory = {
  // Client errors — not retryable, caller must fix
  CLIENT: [
    "INVALID_INPUT",
    "NOT_FOUND",
    "VALIDATION_ERROR",
    "SNAPSHOT_NOT_FOUND",
    "SNAPSHOT_INTEGRITY_ERROR",
  ] as ErrorCode[],
  // Provider errors — may be retryable
  PROVIDER: ["PROVIDER_ERROR", "PROVIDER_TIMEOUT"] as ErrorCode[],
  // Execution errors — may be retryable depending on cause
  EXECUTION: ["EXECUTION_FAILED"] as ErrorCode[],
  // Internal errors — not retryable, indicates bug
  INTERNAL: ["INTERNAL_ERROR"] as ErrorCode[],
} as const;

/**
 * Map of error codes to their default retryable classification.
 * Can be overridden per-instance via InsightError options.
 */
export const DefaultRetryable: Map<ErrorCode, boolean> = new Map([
  ["INVALID_INPUT", false],
  ["NOT_FOUND", false],
  ["VALIDATION_ERROR", false],
  ["PROVIDER_ERROR", true],
  ["PROVIDER_TIMEOUT", true],
  ["SNAPSHOT_NOT_FOUND", false],
  ["SNAPSHOT_INTEGRITY_ERROR", false],
  ["EXECUTION_FAILED", true],
  ["INTERNAL_ERROR", false],
]);

/**
 * Sanitization patterns — remove sensitive data from error details.
 */
const SENSITIVE_KEYS = [
  "apiKey",
  "api_key",
  "authorization",
  "Authorization",
  "secret",
  "Secret",
  "token",
  "Token",
  "password",
  "Password",
  "privateKey",
  "private_key",
  "mnemonic",
  "seed",
] as const;

const SENSITIVE_PATTERNS = [
  /sk_[a-zA-Z0-9]{32,}/g, // Stripe-like secret keys
  /pk_[a-zA-Z0-9]{32,}/g, // Public keys (sometimes sensitive)
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, // Bearer tokens
  /[a-zA-Z0-9]{40,}/g, // Generic long tokens
] as const;

/**
 * Sanitize an object for safe serialization.
 * Removes sensitive keys and masks potential secrets.
 */
function sanitizeForSerialization(value: unknown, depth = 0): unknown {
  if (depth > 10) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;

  // Primitive types
  if (typeof value === "string") {
    let sanitized = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
    return sanitized;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;

  // Arrays
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForSerialization(v, depth + 1));
  }

  // Objects
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, val] of entries) {
      // Skip sensitive keys entirely
      if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().indexOf(sk.toLowerCase()) >= 0)) {
        sanitized[key] = "[REDACTED]";
        continue;
      }
      sanitized[key] = sanitizeForSerialization(val, depth + 1);
    }
    return sanitized;
  }

  return "[UNSERIALIZABLE]";
}

/**
 * InsightError — structured runtime error.
 *
 * All runtime boundaries should throw/return this error type.
 * Safe for public serialization via toJSON().
 */
export class InsightError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Readonly<Record<string, unknown>> | undefined;
  public readonly retryable: boolean;
  // Internal cause — NOT serialized publicly
  private readonly _cause: Error | InsightError | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      details?: Record<string, unknown>;
      cause?: Error | InsightError;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "InsightError";
    this.code = code;
    this.details = options.details
      ? Object.freeze(sanitizeForSerialization(options.details) as Record<string, unknown>)
      : undefined;
    this.retryable = options.retryable ?? DefaultRetryable.get(code) ?? false;
    this._cause = options.cause;
  }

  /**
   * Get the internal cause (for debugging/logging only).
   * NOT included in public serialization.
   */
  get cause(): Error | InsightError | undefined {
    return this._cause;
  }

  /**
   * Check if this error (or its cause chain) matches a code.
   */
  hasCode(code: ErrorCode): boolean {
    if (this.code === code) return true;
    if (this._cause instanceof InsightError) {
      return this._cause.hasCode(code);
    }
    return false;
  }

  /**
   * Get the root cause error in the chain.
   */
  getRootCause(): Error | InsightError {
    let current: Error | InsightError = this;
    while (current instanceof InsightError && current._cause) {
      current = current._cause;
    }
    return current;
  }

  /**
   * Safe public serialization — no secrets, no stack traces, no internal cause.
   */
  toJSON(): {
    name: string;
    code: ErrorCode;
    message: string;
    retryable: boolean;
    details: Readonly<Record<string, unknown>> | undefined;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
    };
  }

  /**
   * String representation for logging (includes code).
   */
  toString(): string {
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * Create an InsightError from an unknown error (normalization).
 * Ensures no raw errors leak — everything becomes a structured InsightError.
 */
export function normalizeError(error: unknown, context?: Record<string, unknown>): InsightError {
  // Already structured — preserve code, add context
  if (error instanceof InsightError) {
    if (context && Object.keys(context).length > 0) {
      const existingDetails = error.details ?? {};
      const sanitizedContext = sanitizeForSerialization(context) as Record<string, unknown>;
      return new InsightError(error.code, error.message, {
        details: { ...existingDetails, ...sanitizedContext },
        cause: error.cause,
        retryable: error.retryable,
      });
    }
    return error;
  }

  // Native Error — classify based on message/type
  if (error instanceof Error) {
    const code = classifyNativeError(error);
    return new InsightError(code, error.message, {
      details: context ? (sanitizeForSerialization(context) as Record<string, unknown>) : undefined,
      cause: error,
      retryable: DefaultRetryable.get(code) ?? false,
    });
  }

  // Unknown type — wrap as internal error
  const message = typeof error === "string" ? error : "Unknown error";
  return new InsightError("INTERNAL_ERROR", message, {
    details: context
      ? (sanitizeForSerialization({ ...context, original: error }) as Record<string, unknown>)
      : undefined,
    retryable: false,
  });
}

/**
 * Classify a native Error into an InsightError code.
 * Heuristics based on common error patterns.
 */
function classifyNativeError(error: Error): ErrorCode {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Timeout errors
  if (
    name.indexOf("timeout") >= 0 ||
    message.indexOf("timeout") >= 0 ||
    message.indexOf("timed out") >= 0 ||
    message.indexOf("etimedout") >= 0 ||
    message.indexOf("socket hang up") >= 0
  ) {
    return "PROVIDER_TIMEOUT";
  }

  // Not found
  if (
    name.indexOf("notfound") >= 0 ||
    message.indexOf("not found") >= 0 ||
    message.indexOf("404") >= 0
  ) {
    return "NOT_FOUND";
  }

  // Validation errors
  if (
    name.indexOf("validation") >= 0 ||
    name.indexOf("invalid") >= 0 ||
    message.indexOf("validation") >= 0 ||
    message.indexOf("invalid input") >= 0 ||
    message.indexOf("invalid argument") >= 0
  ) {
    return "VALIDATION_ERROR";
  }

  // Provider/network errors
  if (
    name.indexOf("network") >= 0 ||
    name.indexOf("fetch") >= 0 ||
    name.indexOf("connection") >= 0 ||
    message.indexOf("econnrefused") >= 0 ||
    message.indexOf("enotfound") >= 0 ||
    message.indexOf("network error") >= 0 ||
    message.indexOf("provider") >= 0
  ) {
    return "PROVIDER_ERROR";
  }

  // Execution failures
  if (
    name.indexOf("execution") >= 0 ||
    message.indexOf("execution failed") >= 0 ||
    message.indexOf("pipeline failed") >= 0
  ) {
    return "EXECUTION_FAILED";
  }

  // Default to internal error for unknown errors
  return "INTERNAL_ERROR";
}

/**
 * Factory functions for common error cases — ensure consistent messages and codes.
 */
export const InsightErrors = {
  invalidInput(message: string, details?: Record<string, unknown>): InsightError {
    return new InsightError("INVALID_INPUT", message, { details, retryable: false });
  },

  notFound(
    resource: string,
    identifier: string | number,
    details?: Record<string, unknown>,
  ): InsightError {
    return new InsightError("NOT_FOUND", `${resource} not found: ${identifier}`, {
      details: { ...details, resource, identifier },
      retryable: false,
    });
  },

  validationError(message: string, details?: Record<string, unknown>): InsightError {
    return new InsightError("VALIDATION_ERROR", message, { details, retryable: false });
  },

  providerError(message: string, details?: Record<string, unknown>, cause?: Error): InsightError {
    return new InsightError("PROVIDER_ERROR", message, { details, cause, retryable: true });
  },

  providerTimeout(message: string, details?: Record<string, unknown>, cause?: Error): InsightError {
    return new InsightError("PROVIDER_TIMEOUT", message, { details, cause, retryable: true });
  },

  snapshotNotFound(id: string, details?: Record<string, unknown>): InsightError {
    return new InsightError("SNAPSHOT_NOT_FOUND", `Snapshot not found: ${id}`, {
      details: { ...details, snapshotId: id },
      retryable: false,
    });
  },

  snapshotIntegrityError(
    id: string,
    reason: string,
    details?: Record<string, unknown>,
  ): InsightError {
    return new InsightError(
      "SNAPSHOT_INTEGRITY_ERROR",
      `Snapshot integrity check failed: ${reason}`,
      {
        details: { ...details, snapshotId: id, reason },
        retryable: false,
      },
    );
  },

  executionFailed(message: string, details?: Record<string, unknown>, cause?: Error): InsightError {
    return new InsightError("EXECUTION_FAILED", message, { details, cause, retryable: true });
  },

  internalError(message: string, details?: Record<string, unknown>, cause?: Error): InsightError {
    return new InsightError("INTERNAL_ERROR", message, { details, cause, retryable: false });
  },
} as const;

/**
 * Check if an error is retryable.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof InsightError) return error.retryable;
  return false; // Unknown errors are not retryable by default
}

/**
 * Extract the error code from any error.
 */
export function getErrorCode(error: unknown): ErrorCode | undefined {
  if (error instanceof InsightError) return error.code;
  return undefined;
}
