/**
 * CanonicalEvidence.ts — Provider-independent canonical evidence model.
 *
 * This is the single source of truth for normalized evidence across all providers.
 * Every provider normalizer MUST output this exact shape.
 * No provider-specific fields. No business logic. Pure data model.
 */

import type { SourceMetadata } from "./SourceMetadata";

/**
 * Supported evidence type categories.
 * Extend only when a genuinely new class of evidence emerges.
 */
export type EvidenceType =
  | "market-movement"
  | "protocol-tvl"
  | "onchain-activity"
  | "wallet-activity"
  | "raw-project"
  | "project"
  | "evidence"
  | "narrative";

/**
 * CanonicalEvidence — the normalized, provider-agnostic evidence model.
 *
 * All fields are required unless marked optional.
 * Metadata is extensible but MUST only contain deterministic, factual data.
 */
export interface CanonicalEvidence {
  /** Globally unique identifier for this evidence item. */
  id: string;

  /** Stable source identifier (e.g., "coingecko", "defillama", "solana-rpc", "helius"). */
  sourceId: string;

  /** Source type category for routing and grouping. */
  sourceType: string;

  /** Evidence type classification. */
  evidenceType: EvidenceType;

  /** Unix timestamp (ms) when this evidence was collected by the pipeline. */
  collectedAt: number;

  /** Optional: Unix timestamp (ms) when the original data was published by the source. */
  publishedAt?: number;

  /** Optional: Human-readable title/summary. */
  title?: string;

  /** Core evidence content — structure varies by evidenceType but MUST be JSON-serializable. */
  content: unknown;

  /** Optional: Canonical URL to the source data. */
  url?: string;

  /** Optional: Author or entity responsible for the source data. */
  author?: string;

  /** Tags for filtering and categorization. */
  tags: string[];

  /** Extensible metadata bag — provider-agnostic, deterministic fields only. */
  metadata: SourceMetadata & Record<string, unknown>;
}

/**
 * Type guard to check if an object is a valid CanonicalEvidence.
 */
export function isCanonicalEvidence(value: unknown): value is CanonicalEvidence {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.id === "string" &&
    typeof v.sourceId === "string" &&
    typeof v.sourceType === "string" &&
    typeof v.evidenceType === "string" &&
    typeof v.collectedAt === "number" &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => typeof t === "string") &&
    v.metadata !== null &&
    typeof v.metadata === "object" &&
    (v.publishedAt === undefined || typeof v.publishedAt === "number") &&
    (v.title === undefined || typeof v.title === "string") &&
    (v.url === undefined || typeof v.url === "string") &&
    (v.author === undefined || typeof v.author === "string") &&
    v.content !== undefined
  );
}

/**
 * Create CanonicalEvidence with required fields and sensible defaults.
 */
export function createCanonicalEvidence(params: {
  id: string;
  sourceId: string;
  sourceType: string;
  evidenceType: EvidenceType;
  content: unknown;
  metadata: SourceMetadata;
  collectedAt?: number;
  publishedAt?: number;
  title?: string;
  url?: string;
  author?: string;
  tags?: string[];
}): CanonicalEvidence {
  const extendedMetadata: SourceMetadata & Record<string, unknown> = {
    ...params.metadata,
  };
  return {
    id: params.id,
    sourceId: params.sourceId,
    sourceType: params.sourceType,
    evidenceType: params.evidenceType,
    collectedAt: params.collectedAt ?? Date.now(),
    publishedAt: params.publishedAt,
    title: params.title,
    content: params.content,
    url: params.url,
    author: params.author,
    tags: params.tags ?? [],
    metadata: extendedMetadata,
  };
}
