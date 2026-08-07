/**
 * SignalTypes.ts — Core type definitions for the Intelligence Signal layer.
 *
 * This layer analyzes EvidenceCollection from the data layer to produce
 * IntelligenceSignal — structured reasoning outputs without financial advice.
 */

import type { EvidenceCollection, EvidenceItem } from "@insight/data";

/** A single piece of evidence contributing to a signal. */
export interface SignalEvidence {
  /** Reference to the EvidenceItem.id from EvidenceCollection. */
  evidenceId: string;
  /** Human-readable description of the relationship (e.g., "supports", "contradicts", "correlates"). */
  relationship: string;
  /** Optional: weight of this evidence in the signal (0-1). */
  weight?: number;
}

/** Core intelligence signal generated from correlated evidence. */
export interface IntelligenceSignal {
  /** Unique identifier for this signal. */
  id: string;
  /** Signal category/type (e.g., "ecosystem-growth", "protocol-decline", "cross-chain-bridge-risk"). */
  type: string;
  /** Human-readable title. */
  title: string;
  /** Detailed description of what the signal means. */
  description: string;
  /** Confidence score (0-1) — deterministic calculation based on evidence quality/quantity. */
  confidence: number;
  /** List of evidence IDs that support this signal. */
  evidenceIds: string[];
  /** Detailed evidence references with relationships. */
  supportingEvidence: SignalEvidence[];
  /** Unix timestamp (ms) when the signal was generated. */
  timestamp: number;
  /** Optional: metadata for downstream consumers. */
  metadata?: {
    /** Number of unique providers contributing to this signal. */
    providerCount?: number;
    /** Primary provider type (e.g., "market", "onchain", "governance"). */
    primaryCategory?: string;
    /** Signal strength classification. */
    strength?: "weak" | "moderate" | "strong";
  };
}

/** Result of correlation analysis between evidence items. */
export interface CorrelationResult {
  /** Type of correlation detected. */
  correlationType: string;
  /** Evidence items involved in this correlation. */
  evidenceItems: EvidenceItem<unknown>[];
  /** Strength of correlation (0-1). */
  strength: number;
  /** Human-readable description. */
  description: string;
}

/** Configuration for signal generation. */
export interface SignalEngineConfig {
  /** Minimum confidence threshold for emitting signals (0-1). Default: 0.3 */
  minConfidence?: number;
  /** Minimum evidence items required for a signal. Default: 2 */
  minEvidenceCount?: number;
  /** Whether to include weak signals. Default: false */
  includeWeakSignals?: boolean;
  /** Custom correlation rules. */
  customRules?: CorrelationRule[];
}

/** Input for confidence calculation. */
export interface ConfidenceInput {
  /** Number of evidence items supporting the signal. */
  evidenceCount: number;
  /** Number of unique providers contributing evidence. */
  providerCount: number;
  /** Strength of correlation between evidence items (0-1). */
  correlationStrength: number;
  /** Recency factor (0-1) — 1 = very recent, 0 = stale. */
  recency: number;
  /** Number of distinct evidence types. */
  evidenceTypes: number;
}

/** A custom correlation rule for domain-specific patterns. */
export interface CorrelationRule {
  /** Unique rule identifier. */
  id: string;
  /** Evidence types this rule applies to. */
  applicableTypes: string[];
  /** Minimum number of matching evidence items. */
  minMatches: number;
  /** Signal type to emit when rule matches. */
  signalType: string;
  /** Signal title template. */
  titleTemplate: string;
  /** Signal description template. */
  descriptionTemplate: string;
}

/** Default signal types for ecosystem intelligence. */
export const SIGNAL_TYPES = {
  ECOSYSTEM_GROWTH: "ecosystem-growth",
  ECOSYSTEM_DECLINE: "ecosystem-decline",
  PROTOCOL_MOMENTUM: "protocol-momentum",
  PROTOCOL_STAGNATION: "protocol-stagnation",
  CROSS_CHAIN_ACTIVITY: "cross-chain-activity",
  LIQUIDITY_SHIFT: "liquidity-shift",
  GOVERNANCE_ACTIVITY: "governance-activity",
  DEVELOPER_ACTIVITY: "developer-activity",
  SECURITY_SIGNAL: "security-signal",
  UNKNOWN: "unknown",
} as const;

export type SignalType = (typeof SIGNAL_TYPES)[keyof typeof SIGNAL_TYPES];

// Re-export EvidenceItem and EvidenceCollection for convenience
export type { EvidenceItem, EvidenceCollection } from "@insight/data";
