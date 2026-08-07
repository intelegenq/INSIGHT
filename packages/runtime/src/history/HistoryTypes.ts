/**
 * @insight/runtime/history — public types for historical analysis.
 */

import type { NarrativeTrend, ProjectCategory } from "@insight/core";

/** Direction of a numeric change. */
export type ChangeDirection = "increased" | "decreased" | "unchanged";

/** A single numeric metric change for a project. */
export interface ProjectMetricChange {
  /** Metric name (e.g. "tvl", "volume24h", "activeUsers24h"). */
  metric: string;
  /** Previous value, when defined in the older snapshot. */
  from: number | undefined;
  /** Current value, when defined in the newer snapshot. */
  to: number | undefined;
  /** Signed delta (to - from). Undefined when either side is missing. */
  delta: number | undefined;
  /** Direction classification. */
  direction: ChangeDirection;
}

/** What changed about a project between two snapshots. */
export interface ProjectChange {
  /** Stable project identifier. */
  projectId: string;
  /** Display name of the project (taken from the newer snapshot, falling back to older). */
  name: string;
  /** Project category. */
  category: ProjectCategory;
  /** Numeric metric changes (only present when values differ). */
  metrics: ProjectMetricChange[];
  /** Whether the description text changed. */
  descriptionChanged: boolean;
}

/** What changed about a narrative between two snapshots. */
export interface NarrativeChange {
  /** Stable narrative identifier. */
  narrativeId: string;
  /** Display name of the narrative. */
  name: string;
  /** Trend in the older snapshot, when present. */
  fromTrend: NarrativeTrend | undefined;
  /** Trend in the newer snapshot, when present. */
  toTrend: NarrativeTrend | undefined;
  /** Direction classification of the trend change. */
  trendChange: ChangeDirection | "trend-shifted" | "trend-stable" | "appeared" | "disappeared";
  /** Whether the human-readable note text changed. */
  noteChanged: boolean;
}

/** High-level counts describing a history comparison. */
export interface HistorySummary {
  /** Number of projects present in the newer snapshot but not the older one. */
  addedProjects: number;
  /** Number of projects present in the older snapshot but not the newer one. */
  removedProjects: number;
  /** Number of projects present in both snapshots. */
  commonProjects: number;
  /** Number of projects whose metrics or description changed. */
  changedProjects: number;
  /** Number of narratives whose trend or note changed. */
  changedNarratives: number;
}

/** Result of comparing two snapshots. */
export interface HistoryDiff {
  /** Identifier of the older snapshot. */
  fromId: string;
  /** Identifier of the newer snapshot. */
  toId: string;
  /** Reference date of the older snapshot. */
  fromReferenceDate: string;
  /** Reference date of the newer snapshot. */
  toReferenceDate: string;
  /** Sorted (by projectId) per-project changes. */
  projects: ProjectChange[];
  /** Sorted (by narrativeId) per-narrative changes. */
  narratives: NarrativeChange[];
  /** Aggregate counts. */
  summary: HistorySummary;
}