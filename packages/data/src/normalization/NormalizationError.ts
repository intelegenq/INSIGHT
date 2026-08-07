/**
 * NormalizationError.ts — Typed errors for the normalization layer.
 *
 * All errors are deterministic and serializable.
 * No provider logic, no runtime dependencies.
 */

export class NormalizationError extends Error {
  public readonly code: string;
  public readonly sourceType?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    options?: { sourceType?: string; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "NormalizationError";
    this.code = code;
    this.sourceType = options?.sourceType;
    this.details = options?.details;
  }

  /** Serialize error for logging/transport. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      sourceType: this.sourceType,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * UnsupportedSourceError — No normalizer registered for the given source type.
 */
export class UnsupportedSourceError extends NormalizationError {
  constructor(sourceType: string, details?: Record<string, unknown>) {
    super(`No normalizer registered for source type: ${sourceType}`, "UNSUPPORTED_SOURCE", {
      sourceType,
      details,
    });
    this.name = "UnsupportedSourceError";
  }
}

/**
 * InvalidPayloadError — Provider payload failed validation or parsing.
 */
export class InvalidPayloadError extends NormalizationError {
  constructor(message: string, sourceType: string, details?: Record<string, unknown>) {
    super(message, "INVALID_PAYLOAD", { sourceType, details });
    this.name = "InvalidPayloadError";
  }
}

/**
 * MissingRequiredFieldError — Required field absent from provider payload.
 */
export class MissingRequiredFieldError extends NormalizationError {
  public readonly fieldName: string;

  constructor(fieldName: string, sourceType: string, details?: Record<string, unknown>) {
    super(`Required field missing: ${fieldName}`, "MISSING_REQUIRED_FIELD", {
      sourceType,
      details,
    });
    this.name = "MissingRequiredFieldError";
    this.fieldName = fieldName;
  }
}

/**
 * SchemaMismatchError — Provider payload structure doesn't match expected schema.
 */
export class SchemaMismatchError extends NormalizationError {
  public readonly expectedSchema: string;
  public readonly actualSchema?: string;

  constructor(
    message: string,
    sourceType: string,
    expectedSchema: string,
    actualSchema?: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "SCHEMA_MISMATCH", { sourceType, details });
    this.name = "SchemaMismatchError";
    this.expectedSchema = expectedSchema;
    this.actualSchema = actualSchema;
  }
}

/**
 * Type guard for NormalizationError.
 */
export function isNormalizationError(value: unknown): value is NormalizationError {
  return value instanceof NormalizationError;
}

/**
 * Type guard for specific error types.
 */
export function isUnsupportedSourceError(value: unknown): value is UnsupportedSourceError {
  return value instanceof UnsupportedSourceError;
}

export function isInvalidPayloadError(value: unknown): value is InvalidPayloadError {
  return value instanceof InvalidPayloadError;
}

export function isMissingRequiredFieldError(value: unknown): value is MissingRequiredFieldError {
  return value instanceof MissingRequiredFieldError;
}

export function isSchemaMismatchError(value: unknown): value is SchemaMismatchError {
  return value instanceof SchemaMismatchError;
}
