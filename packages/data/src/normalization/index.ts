/**
 * @insight/data/normalization — Provider-independent evidence normalization layer.
 *
 * Converts provider-specific DTOs into CanonicalEvidence before data reaches EvidenceCollector.
 * ZERO business logic. No AI. No scoring. No confidence. No interpretation.
 * Only deterministic normalization.
 */

// Type-only exports (interfaces and type aliases only - NOT classes)
export type { CanonicalEvidence, EvidenceType } from "./CanonicalEvidence";
export type { SourceMetadata } from "./SourceMetadata";
export type { Normalizer, NormalizationResult } from "./Normalizer";
export type { ProviderCapability } from "./ProviderCapability";
export type { ProviderDescriptor } from "./ProviderDescriptor";
export type { ProviderRegistry } from "./ProviderRegistry";

// Value exports (functions, classes, constants)
export { isCanonicalEvidence, createCanonicalEvidence } from "./CanonicalEvidence";
export { createSourceMetadata, isSourceMetadata } from "./SourceMetadata";
export { BaseNormalizer, normalizeWithErrors } from "./Normalizer";
export { NormalizationRegistry, normalizationRegistry } from "./NormalizationRegistry";
export {
  NormalizationError,
  UnsupportedSourceError,
  InvalidPayloadError,
  MissingRequiredFieldError,
  SchemaMismatchError,
  isNormalizationError,
  isUnsupportedSourceError,
  isInvalidPayloadError,
  isMissingRequiredFieldError,
  isSchemaMismatchError,
} from "./NormalizationError";
