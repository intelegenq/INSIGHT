/**
 * Normalizer.ts — Generic normalizer interface.
 *
 * Every provider normalizer MUST implement this interface.
 * Normalization MUST be deterministic, pure, and side-effect free.
 * No business logic, no scoring, no interpretation.
 */

import type { CanonicalEvidence } from "./CanonicalEvidence";
import {
  NormalizationError,
  UnsupportedSourceError,
  InvalidPayloadError,
} from "./NormalizationError";

/**
 * Normalizer interface — converts provider-specific input to CanonicalEvidence[].
 *
 * @typeParam Input - Provider-specific raw payload type.
 *
 * Implementations MUST:
 * - Be deterministic (same input → same output)
 * - Be pure (no side effects, no I/O, no randomness)
 * - Throw NormalizationError subclasses for failures
 * - Return CanonicalEvidence[] (never throw on valid input)
 */
export interface Normalizer<Input> {
  /**
   * Check if this normalizer supports the given source type.
   * Used by NormalizationRegistry for routing.
   */
  supports(sourceType: string): boolean;

  /**
   * Normalize provider payload to canonical evidence.
   *
   * @param input - Raw provider payload (provider-specific type).
   * @returns Array of CanonicalEvidence items.
   * @throws NormalizationError subclasses on invalid/unsupported input.
   */
  normalize(input: Input): CanonicalEvidence[];
}

/**
 * Abstract base normalizer with common validation logic.
 * Extend this to reduce boilerplate in provider normalizers.
 */
export abstract class BaseNormalizer<Input> implements Normalizer<Input> {
  protected readonly supportedSourceTypes: readonly string[];
  protected readonly schemaVersion: string;

  constructor(supportedSourceTypes: readonly string[], schemaVersion = "1.0.0") {
    this.supportedSourceTypes = supportedSourceTypes;
    this.schemaVersion = schemaVersion;
  }

  supports(sourceType: string): boolean {
    return this.supportedSourceTypes.indexOf(sourceType) !== -1;
  }

  abstract normalize(input: Input): CanonicalEvidence[];

  /**
   * Validate required fields exist in input.
   * Throws MissingRequiredFieldError if any field is missing.
   */
  protected validateRequiredFields(
    input: Record<string, unknown>,
    fields: readonly string[],
    sourceType: string,
  ): void {
    for (const field of fields) {
      if (!(field in input) || input[field] === undefined || input[field] === null) {
        throw new InvalidPayloadError(`Missing required field: ${field}`, sourceType, {
          missingField: field,
          availableFields: Object.keys(input),
        });
      }
    }
  }

  /**
   * Validate input is an array (for collection-style payloads).
   */
  protected validateArray<T>(input: unknown, sourceType: string): T[] {
    if (!Array.isArray(input)) {
      throw new InvalidPayloadError(`Expected array, got ${typeof input}`, sourceType, {
        receivedType: typeof input,
        isNull: input === null,
      });
    }
    return input as T[];
  }

  /**
   * Create CanonicalEvidence with standardized metadata.
   * Subclasses should implement this using their own imports to avoid circular dependencies.
   */
  protected abstract createEvidence(params: {
    id: string;
    sourceType: string;
    evidenceType: CanonicalEvidence["evidenceType"];
    content: unknown;
    provider: string;
    providerVersion: string;
    collectedAt?: number;
    publishedAt?: number;
    title?: string;
    url?: string;
    author?: string;
    tags?: string[];
    endpoint?: string;
    requestParams?: Record<string, unknown>;
  }): CanonicalEvidence;
}

/**
 * Result wrapper for normalization operations.
 * Used when normalization might partially succeed.
 */
export interface NormalizationResult {
  success: boolean;
  evidence: CanonicalEvidence[];
  errors: NormalizationError[];
}

/**
 * Normalize with error collection (doesn't throw on individual failures).
 * Useful for batch processing where partial success is acceptable.
 */
export function normalizeWithErrors<Input>(
  normalizer: Normalizer<Input>,
  inputs: Input[],
  sourceType: string,
): NormalizationResult {
  const evidence: CanonicalEvidence[] = [];
  const errors: NormalizationError[] = [];

  for (const input of inputs) {
    try {
      const result = normalizer.normalize(input);
      evidence.push(...result);
    } catch (error) {
      if (error instanceof NormalizationError) {
        errors.push(error);
      } else {
        errors.push(
          new InvalidPayloadError(
            error instanceof Error ? error.message : "Unknown normalization error",
            sourceType,
            { originalError: String(error) },
          ),
        );
      }
    }
  }

  return {
    success: errors.length === 0,
    evidence,
    errors,
  };
}
