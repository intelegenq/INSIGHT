import type { EvidenceStatus, ReportLens } from "@insight/core";

/**
 * Source-level types: shapes a data source (or the demo source) emits
 * before normalization into @insight/core domain objects.
 */

/** Snapshot of headline ecosystem metrics for the pulse dashboard. */
export interface PulseMetric {
  id: string;
  label: string;
  value: string;
  caption: string;
  variant?: "default" | "violet";
}

/** Full pulse snapshot: as-of marker plus headline metrics. */
export interface PulseSnapshot {
  asOf: string;
  metrics: PulseMetric[];
}

/** A single entry on the research timeline. */
export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  source: string;
  confidence: string;
}

/** Directional tone used by the demo narrative source. */
export type DemoNarrativeTone = "positive" | "neutral";

/** Raw narrative record as emitted by the demo source. */
export interface DemoNarrativeSource {
  id: string;
  name: string;
  change: string;
  note: string;
  tone: DemoNarrativeTone;
}

/** Raw evidence record from the demo source. */
export interface DemoEvidenceSource {
  id: string;
  source: string;
  note: string;
  status: EvidenceStatus;
}

/** Raw research-lens brief from the demo source. */
export interface DemoLensBrief {
  lens: ReportLens;
  title: string;
  thesis: string;
  catalyst: string;
  risk: string;
  evidenceIds: string[];
}
