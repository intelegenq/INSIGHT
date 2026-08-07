/**
 * SourceMetadata.ts — Common metadata for evidence sources.
 *
 * Provider-agnostic metadata that travels with every normalized evidence item.
 * No provider-specific fields allowed.
 */

export interface SourceMetadata {
  /** Provider identifier (e.g., "coingecko", "defillama", "solana-rpc", "helius"). */
  provider: string;

  /** Provider API/interface version used for collection. */
  providerVersion: string;

  /** Unix timestamp (ms) when this evidence was collected by the pipeline. */
  collectedAt: number;

  /** Schema version of the CanonicalEvidence model. */
  schemaVersion: string;

  /** Optional: specific endpoint or method used for collection. */
  endpoint?: string;

  /** Optional: raw request parameters for traceability (sanitized). */
  requestParams?: Record<string, unknown>;
}

/**
 * Create SourceMetadata with required fields and sensible defaults.
 */
export function createSourceMetadata(params: {
  provider: string;
  providerVersion: string;
  schemaVersion?: string;
  collectedAt?: number;
  endpoint?: string;
  requestParams?: Record<string, unknown>;
}): SourceMetadata {
  return {
    provider: params.provider,
    providerVersion: params.providerVersion,
    schemaVersion: params.schemaVersion ?? "1.0.0",
    collectedAt: params.collectedAt ?? Date.now(),
    endpoint: params.endpoint,
    requestParams: params.requestParams,
  };
}

/**
 * Type guard for SourceMetadata.
 */
export function isSourceMetadata(value: unknown): value is SourceMetadata {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.provider === "string" &&
    typeof v.providerVersion === "string" &&
    typeof v.collectedAt === "number" &&
    typeof v.schemaVersion === "string" &&
    (v.endpoint === undefined || typeof v.endpoint === "string") &&
    (v.requestParams === undefined ||
      (typeof v.requestParams === "object" && v.requestParams !== null))
  );
}
