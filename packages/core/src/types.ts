/**
 * Domain entities for Insight.
 *
 * This module is deliberately framework-free: no React, no external
 * dependencies. It owns the vocabulary shared by the web app, collectors,
 * and future services.
 */

import type { ChainId } from "./chains";

/** How much a piece of evidence can currently be trusted. */
export type EvidenceStatus = "demo" | "verified" | "pending" | "draft";

/** Where a piece of evidence came from, e.g. "Protocol telemetry". */
export interface EvidenceSource {
  /** Stable machine-readable identifier of the source. */
  id: string;
  /** Human-readable source name. */
  name: string;
  /** Optional chain this source reports on (defaults to Solana when absent). */
  chain?: ChainId;
}

/** A single citable signal backing a claim. */
export interface Evidence {
  id: string;
  source: EvidenceSource;
  note: string;
  status: EvidenceStatus;
  /** ISO-8601 timestamp of when the evidence was observed. */
  observedAt: string;
  /** Optional pointer to the underlying artifact (URL, tx, file). */
  reference?: string;
  /** Optional chain this evidence was observed on (defaults to Solana). */
  chain?: ChainId;
}

/** Optional structured confidence range for a generated statement. */
export interface Confidence {
  /** Lower bound, 0..1. */
  min: number;
  /** Upper bound, 0..1. */
  max: number;
}

/** Ecosystem category a project belongs to. */
export type ProjectCategory =
  | "defi"
  | "dex"
  | "lending"
  | "yield"
  | "liquid-staking"
  | "bridge"
  | "derivatives"
  | "payments"
  | "nft"
  | "oracle"
  | "rwa"
  | "gaming"
  | "social"
  | "wallets"
  | "infrastructure"
  | "ai"
  | "depin"
  | "stablecoins"
  | "restaking"
  | "mev"
  | "validators"
  | "data"
  | "security"
  | "developer-tools"
  | "consumer"
  | "other";

/** Entity classification — distinguishes ecosystems projects from market context. */
export type EntityClassification = "solana_ecosystem" | "market_context" | "network";

/** Snapshot of traction indicators for a project. */
export interface ProjectMetrics {
  tvl?: number;
  volume24h?: number;
  activeUsers24h?: number;
  developerActivity?: number;
}

/** A protocol or project Insight tracks. */
export interface Project {
  id: string;
  name: string;
  category: ProjectCategory;
  description: string;
  metrics: ProjectMetrics;
  /** Identifiers of the evidence backing this project's view. */
  evidenceIds: string[];
  /** Optional primary chain for the project (defaults to Solana). */
  chain?: ChainId;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
  /** Entity classification — distinguishes ecosystem projects from CEXs/network. */
  classification?: EntityClassification;
}

/** Direction of a narrative's momentum. */
export type NarrativeTrend = "up" | "down" | "flat" | "watch";

/** A surfaced theme connecting related projects and evidence. */
export interface Narrative {
  id: string;
  name: string;
  trend: NarrativeTrend;
  /** Human-readable change summary, e.g. "+18.4%". */
  change?: string;
  note: string;
  /** Identifiers of representative projects. */
  projectIds: string[];
  /** Identifiers of the evidence backing this narrative. */
  evidenceIds: string[];
}

/** Research lens a report can be generated through. */
export type ReportLens = "ecosystem" | "defi" | "infrastructure";

/** Overall confidence label attached to a generated brief. */
export type ReportConfidence = "illustrative" | "draft" | "medium" | "high";

/** Sections of a generated research brief. */
export interface ReportSections {
  thesis: string;
  catalyst?: string;
  risk?: string;
}

/** A generated research brief with retained evidence. */
export interface Report {
  id: string;
  lens: ReportLens;
  title: string;
  sections: ReportSections;
  /** Identifiers of the evidence backing this report. */
  evidenceIds: string[];
  confidence: ReportConfidence;
  /** ISO-8601 timestamp of when the report was generated. */
  generatedAt: string;
  /** True when the report is built from synthetic demo data. */
  isDemo: boolean;
}
