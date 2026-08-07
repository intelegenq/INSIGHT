/**
 * EvidenceTypes.ts — Core type definitions for the Evidence layer.
 *
 * This layer aggregates raw data from multiple providers into structured evidence
 * without any scoring, ranking, or interpretation. Those responsibilities remain
 * in the intelligence layer.
 */

/** Metadata identifying the source of a piece of evidence. */
export interface EvidenceSource {
  /** Unique identifier for this evidence item. */
  id: string;
  /** Provider that produced this evidence (e.g., "coingecko", "defillama", "solana-rpc", "helius"). */
  provider: string;
  /** Unix timestamp (ms) when the evidence was collected. */
  timestamp: number;
  /** Optional: specific endpoint or method used. */
  endpoint?: string;
  /** Optional: raw request parameters for traceability. */
  requestParams?: Record<string, unknown>;
}

/** A single normalized evidence item from any provider. */
export interface EvidenceItem<T = unknown> {
  /** Unique identifier for this evidence item. */
  id: string;
  /** Type/category of evidence (e.g., "market-movement", "protocol-tvl", "onchain-activity", "wallet-activity"). */
  type: string;
  /** Source metadata. */
  source: EvidenceSource;
  /** Raw provider data, normalized to a common shape. */
  data: T;
  /** Optional: human-readable description for debugging. */
  description?: string;
}

/** Collection of evidence items gathered in a single collection run. */
export interface EvidenceCollection<T = unknown> {
  /** Unix timestamp (ms) when the collection was performed. */
  timestamp: number;
  /** All evidence items in this collection. */
  items: EvidenceItem<T>[];
  /** Optional: metadata about the collection run. */
  metadata?: {
    /** Total number of providers queried. */
    providersQueried: number;
    /** Number of providers that succeeded. */
    providersSucceeded: number;
    /** Number of providers that failed. */
    providersFailed: number;
    /** Duration of collection in milliseconds. */
    durationMs: number;
  };
}

/** Configuration for evidence collection. */
export interface EvidenceCollectorConfig {
  /** Maximum time to wait for all providers (ms). Default: 30_000. */
  timeoutMs?: number;
  /** Whether to continue collecting from other providers if one fails. Default: true. */
  continueOnFailure?: boolean;
}

/** Result of normalizing a single raw provider response. */
export interface NormalizeResult<T = unknown> {
  /** Whether normalization succeeded. */
  success: boolean;
  /** Normalized evidence items (empty if failed). */
  items: EvidenceItem<T>[];
  /** Error message if normalization failed. */
  error?: string;
}
