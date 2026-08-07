/**
 * NormalizationRegistry.ts — Registry for evidence normalizers.
 *
 * Responsibilities:
 * - Register normalizers
 * - Resolve correct normalizer for a source type
 * - Normalize incoming provider payloads
 * - Reject unsupported payloads
 *
 * No provider logic. No runtime dependency.
 */

import type { Normalizer, NormalizationResult } from "./Normalizer";
import type { CanonicalEvidence } from "./CanonicalEvidence";
import { UnsupportedSourceError, InvalidPayloadError } from "./NormalizationError";

/**
 * Registry entry for a normalizer.
 */
interface RegistryEntry<Input> {
  normalizer: Normalizer<Input>;
  sourceTypes: readonly string[];
}

/**
 * NormalizationRegistry — manages normalizer registration and dispatch.
 *
 * Thread-safe for single-threaded JS (no concurrent mutation).
 * Normalizers registered at startup, then read-only during operation.
 */
export class NormalizationRegistry {
  private readonly entries: Map<string, RegistryEntry<unknown>> = new Map();

  /**
   * Register a normalizer for one or more source types.
   * @throws InvalidPayloadError if sourceTypes is empty or normalizer already registered for any type.
   */
  register<Input>(normalizer: Normalizer<Input>, sourceTypes: readonly string[]): this {
    if (sourceTypes.length === 0) {
      throw new InvalidPayloadError("At least one sourceType must be provided", "registry", {
        normalizer: normalizer.constructor.name,
      });
    }

    for (const sourceType of sourceTypes) {
      if (this.entries.has(sourceType)) {
        throw new InvalidPayloadError(
          `Normalizer already registered for sourceType: ${sourceType}`,
          "registry",
          {
            sourceType,
            existingNormalizer: this.entries.get(sourceType)?.normalizer.constructor.name,
            newNormalizer: normalizer.constructor.name,
          },
        );
      }
    }

    const entry: RegistryEntry<unknown> = { normalizer, sourceTypes };
    for (const sourceType of sourceTypes) {
      this.entries.set(sourceType, entry);
    }

    return this;
  }

  /**
   * Check if a source type has a registered normalizer.
   */
  has(sourceType: string): boolean {
    return this.entries.has(sourceType);
  }

  /**
   * Get all registered source types.
   */
  getRegisteredSourceTypes(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get the normalizer for a source type.
   * @throws UnsupportedSourceError if no normalizer registered.
   */
  getNormalizer<Input>(sourceType: string): Normalizer<Input> {
    const entry = this.entries.get(sourceType);
    if (!entry) {
      throw new UnsupportedSourceError(sourceType, {
        registeredSourceTypes: this.getRegisteredSourceTypes(),
      });
    }
    return entry.normalizer as Normalizer<Input>;
  }

  /**
   * Normalize a single payload using the appropriate normalizer.
   * @throws UnsupportedSourceError if no normalizer for sourceType.
   * @throws NormalizationError subclasses on normalization failure.
   */
  normalize<Input>(sourceType: string, input: Input): CanonicalEvidence[] {
    const normalizer = this.getNormalizer<Input>(sourceType);
    return normalizer.normalize(input);
  }

  /**
   * Normalize multiple payloads with error collection.
   * Does not throw on individual failures — returns result with errors array.
   */
  normalizeWithErrors<Input>(sourceType: string, inputs: Input[]): NormalizationResult {
    const normalizer = this.getNormalizer<Input>(sourceType);

    const evidence: CanonicalEvidence[] = [];
    const errors: Error[] = [];

    for (const input of inputs) {
      try {
        const result = normalizer.normalize(input);
        evidence.push(...result);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return {
      success: errors.length === 0,
      evidence,
      errors: errors as import("./NormalizationError").NormalizationError[],
    };
  }

  /**
   * Unregister all normalizers for a source type.
   * Returns true if any were removed.
   */
  unregister(sourceType: string): boolean {
    return this.entries.delete(sourceType);
  }

  /**
   * Clear all registered normalizers.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get count of registered normalizers.
   */
  size(): number {
    return this.entries.size;
  }
}

/**
 * Global default registry instance.
 * Use this for application-wide normalization unless isolation is needed.
 */
export const normalizationRegistry = new NormalizationRegistry();
