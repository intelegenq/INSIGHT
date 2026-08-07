/**
 * @insight/runtime/validation — Reusable validation helpers for runtime boundaries.
 *
 * Small, focused validators that produce structured InsightErrors.
 * Not a full validation framework — only what the runtime boundaries need.
 */

import type { ReportLens } from "@insight/core";
import { InsightError, InsightErrors } from "../errors";

/**
 * Validation result type — either success with value or failure with error.
 */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: InsightError };

/**
 * Validate a required string (non-empty after trim).
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
  options?: { maxLength?: number; pattern?: RegExp; patternName?: string }
): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} must be a string`, { field: fieldName, received: typeof value }) };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} is required`, { field: fieldName }) };
  }

  if (options?.maxLength && trimmed.length > options.maxLength) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} exceeds maximum length of ${options.maxLength}`, { field: fieldName, maxLength: options.maxLength, actualLength: trimmed.length }) };
  }

  if (options?.pattern && !options.pattern.test(trimmed)) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} has invalid format${options.patternName ? ` (expected ${options.patternName})` : ""}`, { field: fieldName, value: trimmed }) };
  }

  return { ok: true, value: trimmed };
}

/**
 * Validate an enum value.
 */
export function validateEnum<T extends string>(
  value: unknown,
  enumValues: readonly T[],
  fieldName: string
): ValidationResult<T> {
  if (typeof value !== "string") {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} must be a string`, { field: fieldName, received: typeof value, allowed: enumValues }) };
  }

  if (!enumValues.includes(value as T)) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} must be one of: ${enumValues.join(", ")}`, { field: fieldName, value, allowed: enumValues }) };
  }

  return { ok: true, value: value as T };
}

/**
 * Validate an ISO-8601 date string (used for referenceDate).
 * Does NOT validate the date is in the past/future — just format.
 */
export function validateReferenceDate(
  value: unknown,
  fieldName = "referenceDate"
): ValidationResult<string> {
  const stringResult = validateRequiredString(value, fieldName);
  if (!stringResult.ok) return stringResult;

  const dateStr = stringResult.value;

  // Validate ISO-8601 format (YYYY-MM-DDTHH:mm:ss.sssZ or similar)
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!iso8601Regex.test(dateStr)) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} must be a valid ISO-8601 timestamp (e.g., 2026-08-07T00:00:00.000Z)`, { field: fieldName, value: dateStr }) };
  }

  // Validate it's a parseable date
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} is not a valid date`, { field: fieldName, value: dateStr }) };
  }

  return { ok: true, value: dateStr };
}

/**
 * Validate a ReportLens value.
 */
export function validateReportLens(value: unknown): ValidationResult<ReportLens> {
  return validateEnum(value, ["ecosystem", "defi", "infrastructure"], "lens");
}

/**
 * Validate a history range (from/to dates).
 * Both must be valid ISO-8601 dates, and from <= to.
 */
export function validateHistoryRange(
  from: unknown,
  to: unknown
): ValidationResult<{ from: string; to: string }> {
  const fromResult = validateReferenceDate(from, "from");
  if (!fromResult.ok) return fromResult as ValidationResult<{ from: string; to: string }>;

  const toResult = validateReferenceDate(to, "to");
  if (!toResult.ok) return toResult as ValidationResult<{ from: string; to: string }>;

  const fromTime = Date.parse(fromResult.value);
  const toTime = Date.parse(toResult.value);

  if (fromTime > toTime) {
    return { ok: false, error: InsightErrors.validationError("from date must be before or equal to to date", { from: fromResult.value, to: toResult.value }) };
  }

  return { ok: true, value: { from: fromResult.value, to: toResult.value } };
}

/**
 * Validate a positive integer (for limits, page sizes, etc.).
 */
export function validatePositiveInteger(
  value: unknown,
  fieldName: string,
  options?: { max?: number }
): ValidationResult<number> {
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      return { ok: false, error: InsightErrors.validationError(`${fieldName} must be an integer`, { field: fieldName, value }) };
    }
    value = parsed;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} must be an integer`, { field: fieldName, received: typeof value }) };
  }

  if (value <= 0) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} must be positive`, { field: fieldName, value }) };
  }

  if (options?.max && value > options.max) {
    return { ok: false, error: InsightErrors.validationError(`${fieldName} exceeds maximum of ${options.max}`, { field: fieldName, max: options.max, value }) };
  }

  return { ok: true, value };
}

/**
 * Validate an execution ID format (exec-<timestamp>-<counter>).
 */
export function validateExecutionId(value: unknown): ValidationResult<string> {
  const stringResult = validateRequiredString(value, "executionId");
  if (!stringResult.ok) return stringResult;

  const execIdRegex = /^exec-\d+-\d+$/;
  if (!execIdRegex.test(stringResult.value)) {
    return { ok: false, error: InsightErrors.validationError("executionId must match format: exec-<timestamp>-<counter>", { field: "executionId", value: stringResult.value }) };
  }

  return { ok: true, value: stringResult.value };
}

/**
 * Validate a snapshot ID format (snap-<executionId>-<hash>).
 */
export function validateSnapshotId(value: unknown): ValidationResult<string> {
  const stringResult = validateRequiredString(value, "snapshotId");
  if (!stringResult.ok) return stringResult;

  const snapIdRegex = /^snap-exec-\d+-\d+-[0-9a-f]{8}$/;
  if (!snapIdRegex.test(stringResult.value)) {
    return { ok: false, error: InsightErrors.validationError("snapshotId must match format: snap-exec-<timestamp>-<counter>-<8-char-hex>", { field: "snapshotId", value: stringResult.value }) };
  }

  return { ok: true, value: stringResult.value };
}

/**
 * Validate a job ID (non-empty string, alphanumeric with hyphens/underscores).
 */
export function validateJobId(value: unknown): ValidationResult<string> {
  const stringResult = validateRequiredString(value, "jobId", {
    pattern: /^[a-zA-Z0-9_-]+$/,
    patternName: "alphanumeric with hyphens/underscores",
    maxLength: 100,
  });
  return stringResult;
}

/**
 * Safe parsing of user-facing JSON input.
 * Returns structured error on parse failure.
 */
export function safeJsonParse<T>(input: unknown, context?: string): ValidationResult<T> {
  if (typeof input !== "string") {
    return { ok: false, error: InsightErrors.validationError("Input must be a JSON string", { context, receivedType: typeof input }) };
  }

  try {
    const parsed = JSON.parse(input) as T;
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: InsightErrors.validationError("Invalid JSON input", { context, error: error instanceof Error ? error.message : String(error) }) };
  }
}

/**
 * Combine multiple validation results — fail fast on first error.
 */
export function validateAll<T extends unknown[]>(
  ...results: { [K in keyof T]: ValidationResult<T[K]> }
): ValidationResult<T> {
  for (const result of results) {
    if (!result.ok) {
      return result as ValidationResult<T>;
    }
  }
  return { ok: true, value: results.map((r) => (r as { ok: true; value: unknown }).value) as T };
}

/**
 * Type guard to narrow ValidationResult
 */
function isValidResult<T>(result: ValidationResult<T>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Assert a validation result — throws if invalid.
 * Use for internal boundaries where you want to fail fast.
 */
export function assertValid<T>(result: ValidationResult<T>, prefix?: string): T {
  if (isValidResult(result)) {
    return result.value;
  }
  const error = result.error;
  // Add prefix to message if provided
  if (prefix) {
    throw new InsightError(error.code, `${prefix}: ${error.message}`, {
      details: error.details,
      cause: error.cause,
      retryable: error.retryable,
    });
  }
  throw error;
}

/**
 * Utility: extract value or throw.
 * For use in non-async contexts where ValidationResult is returned.
 */
export function unwrapOrThrow<T>(result: ValidationResult<T>): T {
  return assertValid(result);
}