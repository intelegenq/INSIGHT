/**
 * @insight/runtime/validation — Reusable validation helpers for runtime boundaries.
 */
import type { ReportLens } from "@insight/core";
import { InsightError, InsightErrors } from "../errors";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: InsightError };

export function validateRequiredString(value: unknown, fieldName: string, options?: { maxLength?: number; pattern?: RegExp; patternName?: string }): ValidationResult<string> {
  if (typeof value !== "string") return { ok: false, error: InsightErrors.validationError(`${fieldName} must be a string`, { field: fieldName, received: typeof value }) };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: InsightErrors.validationError(`${fieldName} is required`, { field: fieldName }) };
  if (options?.maxLength && trimmed.length > options.maxLength) return { ok: false, error: InsightErrors.validationError(`${fieldName} exceeds maximum length of ${options.maxLength}`, { field: fieldName, maxLength: options.maxLength, actualLength: trimmed.length }) };
  if (options?.pattern && !options.pattern.test(trimmed)) return { ok: false, error: InsightErrors.validationError(`${fieldName} has invalid format${options.patternName ? ` (expected ${options.patternName})` : ""}`, { field: fieldName, value: trimmed }) };
  return { ok: true, value: trimmed };
}

export function validateEnum<T extends string>(value: unknown, enumValues: readonly T[], fieldName: string): ValidationResult<T> {
  if (typeof value !== "string") return { ok: false, error: InsightErrors.validationError(`${fieldName} must be a string`, { field: fieldName, received: typeof value, allowed: enumValues }) };
  if (!enumValues.includes(value as T)) return { ok: false, error: InsightErrors.validationError(`${fieldName} must be one of: ${enumValues.join(", ")}`, { field: fieldName, value, allowed: enumValues }) };
  return { ok: true, value: value as T };
}

export function validateReferenceDate(value: unknown, fieldName = "referenceDate"): ValidationResult<string> {
  const stringResult = validateRequiredString(value, fieldName);
  if (!stringResult.ok) return stringResult;
  const dateStr = stringResult.value;
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!iso8601Regex.test(dateStr) || Number.isNaN(Date.parse(dateStr))) return { ok: false, error: InsightErrors.validationError(`${fieldName} must be a valid ISO-8601 timestamp (e.g., 2026-08-07T00:00:00.000Z)`, { field: fieldName, value: dateStr }) };
  return { ok: true, value: dateStr };
}

export function validateReportLens(value: unknown): ValidationResult<ReportLens> {
  return validateEnum(value, ["ecosystem", "defi", "infrastructure"], "lens");
}

export function validateHistoryRange(from: unknown, to: unknown): ValidationResult<{ from: string; to: string }> {
  const fromResult = validateReferenceDate(from, "from");
  if (!fromResult.ok) return fromResult as ValidationResult<{ from: string; to: string }>;
  const toResult = validateReferenceDate(to, "to");
  if (!toResult.ok) return toResult as ValidationResult<{ from: string; to: string }>;
  if (Date.parse(fromResult.value) > Date.parse(toResult.value)) return { ok: false, error: InsightErrors.validationError("from date must be before or equal to to date", { from: fromResult.value, to: toResult.value }) };
  return { ok: true, value: { from: fromResult.value, to: toResult.value } };
}

export function validatePositiveInteger(value: unknown, fieldName: string, options?: { max?: number }): ValidationResult<number> {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) value = Number(value);
  if (typeof value !== "number" || !Number.isInteger(value)) return { ok: false, error: InsightErrors.validationError(`${fieldName} must be an integer`, { field: fieldName, received: typeof value }) };
  if (value <= 0) return { ok: false, error: InsightErrors.validationError(`${fieldName} must be positive`, { field: fieldName, value }) };
  if (options?.max && value > options.max) return { ok: false, error: InsightErrors.validationError(`${fieldName} exceeds maximum of ${options.max}`, { field: fieldName, max: options.max, value }) };
  return { ok: true, value };
}

export function validateExecutionId(value: unknown): ValidationResult<string> {
  const result = validateRequiredString(value, "executionId");
  if (!result.ok) return result;
  if (!/^exec-[0-9a-z]{6}$/.test(result.value)) return { ok: false, error: InsightErrors.validationError("executionId must match format: exec-<counter-in-base36>", { field: "executionId", value: result.value }) };
  return result;
}

export function validateSnapshotId(value: unknown): ValidationResult<string> {
  const result = validateRequiredString(value, "snapshotId");
  if (!result.ok) return result;
  if (!/^snapshot-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z-[0-9a-f]{8}$/.test(result.value)) return { ok: false, error: InsightErrors.validationError("snapshotId must match format: snapshot-<ISO timestamp>-<8-char-hex>", { field: "snapshotId", value: result.value }) };
  return result;
}

export function validateJobId(value: unknown): ValidationResult<string> {
  return validateRequiredString(value, "jobId", { pattern: /^[a-zA-Z0-9_-]+$/, patternName: "alphanumeric with hyphens/underscores", maxLength: 100 });
}

export function safeJsonParse<T>(input: unknown, context?: string): ValidationResult<T> {
  if (typeof input !== "string") return { ok: false, error: InsightErrors.validationError("Input must be a JSON string", { context, receivedType: typeof input }) };
  try { return { ok: true, value: JSON.parse(input) as T }; } catch (error) { return { ok: false, error: InsightErrors.validationError("Invalid JSON input", { context, error: error instanceof Error ? error.message : String(error) }) }; }
}

export function validateAll<T extends unknown[]>(...results: { [K in keyof T]: ValidationResult<T[K]> }): ValidationResult<T> {
  for (const result of results) if (!result.ok) return result as ValidationResult<T>;
  return { ok: true, value: results.map((r) => (r as { ok: true; value: unknown }).value) as T };
}

function isValidResult<T>(result: ValidationResult<T>): result is { ok: true; value: T } { return result.ok; }
export function assertValid<T>(result: ValidationResult<T>, prefix?: string): T {
  if (isValidResult(result)) return result.value;
  const error = result.error;
  if (prefix) throw new InsightError(error.code, `${prefix}: ${error.message}`, { details: error.details, cause: error.cause, retryable: error.retryable });
  throw error;
}
export function unwrapOrThrow<T>(result: ValidationResult<T>): T { return assertValid(result); }
