/**
 * AnomalyDetector — deterministic anomaly detection over snapshot diffs.
 *
 * Compares two snapshots and detects meaningful ecosystem anomalies:
 * - TVL changes exceeding a threshold
 * - Volume changes exceeding a threshold
 * - Project health score drops
 * - Narrative trend shifts
 * - Validator delinquency spikes (from evidence)
 * - TPS anomalies (from evidence)
 *
 * Pure and deterministic: given the same snapshots, always produces the
 * same anomalies. No AI, no web search, no external data.
 */
import type { Project, Evidence, Narrative } from "@insight/core";

/** Metric change between two snapshots (mirrors runtime HistoryDiff types). */
interface MetricChange {
  metric: string;
  from: number | undefined;
  to: number | undefined;
  delta: number | undefined;
  direction: "increased" | "decreased" | "unchanged";
}

/** Project change between two snapshots. */
interface ProjectChange {
  projectId: string;
  name: string;
  category: string;
  metrics: MetricChange[];
  descriptionChanged: boolean;
}

/** Narrative change between two snapshots. */
interface NarrativeChange {
  narrativeId: string;
  name: string;
  fromTrend?: string;
  toTrend?: string;
  trendChange: string;
  noteChanged: boolean;
}

/** Snapshot diff result (mirrors runtime HistoryDiff without the dependency). */
interface HistoryDiff {
  fromId: string;
  toId: string;
  fromReferenceDate: string;
  toReferenceDate: string;
  projects: ProjectChange[];
  narratives: NarrativeChange[];
  summary: {
    addedProjects: number;
    removedProjects: number;
    commonProjects: number;
    changedProjects: number;
    changedNarratives: number;
  };
}

/** An detected ecosystem anomaly. */
export interface Anomaly {
  /** Unique anomaly identifier. */
  id: string;
  /** Anomaly type for categorization. */
  type:
    | "tvl_drop"
    | "tvl_rise"
    | "volume_drop"
    | "volume_rise"
    | "health_drop"
    | "health_rise"
    | "trend_shift"
    | "validator_delinquency_spike"
    | "tps_anomaly"
    | "price_move"
    | "new_evidence";
  /** Human-readable description. */
  description: string;
  /** Severity: 1 (low) to 3 (high). */
  severity: 1 | 2 | 3;
  /** The project or narrative affected, if applicable. */
  targetId?: string;
  targetName?: string;
  /** Numeric values (old → new). */
  oldValue?: number;
  newValue?: number;
  /** Percentage change, when applicable. */
  pctChange?: number;
  /** Evidence IDs supporting this anomaly. */
  evidenceIds: string[];
  /** When the anomaly was detected (snapshot reference date). */
  detectedAt: string;
}

/** Configuration for anomaly detection thresholds. */
export interface AnomalyThresholds {
  /** TVL change % that triggers an anomaly (default: 10). */
  tvlChangePct?: number;
  /** Volume change % that triggers an anomaly (default: 25). */
  volumeChangePct?: number;
  /** Health score drop that triggers an anomaly (default: 15 points). */
  healthDropPoints?: number;
  /** Health score rise that triggers an anomaly (default: 15 points). */
  healthRisePoints?: number;
  /** SOL price change % that triggers an anomaly (default: 5). */
  priceMovePct?: number;
}

const DEFAULT_THRESHOLDS: Required<AnomalyThresholds> = {
  tvlChangePct: 10,
  volumeChangePct: 25,
  healthDropPoints: 15,
  healthRisePoints: 15,
  priceMovePct: 5,
};

/**
 * Detect anomalies from a snapshot diff.
 */
export function detectAnomalies(diff: HistoryDiff, thresholds: AnomalyThresholds = {}): Anomaly[] {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const anomalies: Anomaly[] = [];
  const detectedAt = diff.toReferenceDate;

  // 1. TVL and volume changes
  for (const change of diff.projects) {
    for (const metric of change.metrics) {
      const pct = pctChange(metric);
      if (pct === undefined) continue;

      if (metric.metric === "tvl") {
        if (Math.abs(pct) >= t.tvlChangePct) {
          anomalies.push({
            id: `anomaly-tvl-${change.projectId}-${diff.toId}`,
            type: pct < 0 ? "tvl_drop" : "tvl_rise",
            description: `${change.name} TVL ${pct < 0 ? "dropped" : "rose"} ${Math.abs(pct).toFixed(1)}% (${formatNum(metric.from)} → ${formatNum(metric.to)})`,
            severity: Math.abs(pct) >= 30 ? 3 : Math.abs(pct) >= 15 ? 2 : 1,
            targetId: change.projectId,
            targetName: change.name,
            oldValue: metric.from,
            newValue: metric.to,
            pctChange: pct,
            evidenceIds: [],
            detectedAt,
          });
        }
      }

      if (metric.metric === "volume24h") {
        if (Math.abs(pct) >= t.volumeChangePct) {
          anomalies.push({
            id: `anomaly-vol-${change.projectId}-${diff.toId}`,
            type: pct < 0 ? "volume_drop" : "volume_rise",
            description: `${change.name} 24h volume ${pct < 0 ? "dropped" : "rose"} ${Math.abs(pct).toFixed(1)}% (${formatNum(metric.from)} → ${formatNum(metric.to)})`,
            severity: Math.abs(pct) >= 50 ? 3 : Math.abs(pct) >= 35 ? 2 : 1,
            targetId: change.projectId,
            targetName: change.name,
            oldValue: metric.from,
            newValue: metric.to,
            pctChange: pct,
            evidenceIds: [],
            detectedAt,
          });
        }
      }
    }
  }

  // 2. Narrative trend shifts
  for (const change of diff.narratives) {
    if (change.trendChange === "trend-shifted") {
      anomalies.push({
        id: `anomaly-trend-${change.narrativeId}-${diff.toId}`,
        type: "trend_shift",
        description: `${change.name} trend shifted from ${change.fromTrend ?? "unknown"} to ${change.toTrend ?? "unknown"}`,
        severity: 2,
        targetId: change.narrativeId,
        targetName: change.name,
        evidenceIds: [],
        detectedAt,
      });
    }
  }

  // 3. Project additions (new projects appearing)
  if (diff.summary.addedProjects > 0) {
    anomalies.push({
      id: `anomaly-new-projects-${diff.toId}`,
      type: "new_evidence",
      description: `${diff.summary.addedProjects} new project(s) appeared in this snapshot`,
      severity: 1,
      evidenceIds: [],
      detectedAt,
    });
  }

  // 4. Project removals (projects disappearing)
  if (diff.summary.removedProjects > 0) {
    anomalies.push({
      id: `anomaly-removed-projects-${diff.toId}`,
      type: "tvl_drop",
      description: `${diff.summary.removedProjects} project(s) no longer tracked in this snapshot`,
      severity: 2,
      evidenceIds: [],
      detectedAt,
    });
  }

  return anomalies;
}

/**
 * Detect anomalies from evidence items in a single snapshot.
 * Looks for validator delinquency spikes, TPS anomalies, and price moves
 * by analyzing evidence notes from Solana RPC and CoinGecko.
 */
export function detectEvidenceAnomalies(
  evidence: readonly Evidence[],
  previousEvidence: readonly Evidence[],
  thresholds: AnomalyThresholds = {},
): Anomaly[] {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const anomalies: Anomaly[] = [];
  const detectedAt = new Date().toISOString();

  // Find Solana RPC evidence (validators, TPS) and CoinGecko evidence (price)
  const currentValidatorEv = evidence.find((e) => e.id.startsWith("solana-validators-"));
  const previousValidatorEv = previousEvidence.find((e) => e.id.startsWith("solana-validators-"));
  const currentPerfEv = evidence.find((e) => e.id.startsWith("solana-performance-"));
  const previousPerfEv = previousEvidence.find((e) => e.id.startsWith("solana-performance-"));
  const currentPriceEv = evidence.find((e) => e.id.startsWith("coingecko-solana-market"));
  const previousPriceEv = previousEvidence.find((e) => e.id.startsWith("coingecko-solana-market"));

  // Validator delinquency spike
  if (currentValidatorEv && previousValidatorEv) {
    const currentDelinquent = extractNumber(currentValidatorEv.note, "delinquent");
    const previousDelinquent = extractNumber(previousValidatorEv.note, "delinquent");
    if (currentDelinquent !== undefined && previousDelinquent !== undefined) {
      const delta = currentDelinquent - previousDelinquent;
      const pct = previousDelinquent > 0 ? (delta / previousDelinquent) * 100 : 0;
      if (pct > 50) {
        anomalies.push({
          id: `anomaly-delinquency-${detectedAt}`,
          type: "validator_delinquency_spike",
          description: `Validator delinquency spiked: ${previousDelinquent} → ${currentDelinquent} (+${pct.toFixed(0)}%)`,
          severity: pct > 200 ? 3 : 2,
          oldValue: previousDelinquent,
          newValue: currentDelinquent,
          pctChange: pct,
          evidenceIds: [currentValidatorEv.id, previousValidatorEv.id],
          detectedAt,
        });
      }
    }
  }

  // TPS anomaly
  if (currentPerfEv && previousPerfEv) {
    const currentTps = extractNumber(currentPerfEv.note, "TPS");
    const previousTps = extractNumber(previousPerfEv.note, "TPS");
    if (currentTps !== undefined && previousTps !== undefined && previousTps > 0) {
      const pct = ((currentTps - previousTps) / previousTps) * 100;
      if (Math.abs(pct) >= 30) {
        anomalies.push({
          id: `anomaly-tps-${detectedAt}`,
          type: "tps_anomaly",
          description: `TPS ${pct < 0 ? "dropped" : "surged"} ${Math.abs(pct).toFixed(0)}% (${previousTps} → ${currentTps})`,
          severity: Math.abs(pct) >= 60 ? 3 : 2,
          oldValue: previousTps,
          newValue: currentTps,
          pctChange: pct,
          evidenceIds: [currentPerfEv.id, previousPerfEv.id],
          detectedAt,
        });
      }
    }
  }

  // SOL price move
  if (currentPriceEv && previousPriceEv) {
    const currentPrice = extractPrice(currentPriceEv.note);
    const previousPrice = extractPrice(previousPriceEv.note);
    if (currentPrice !== undefined && previousPrice !== undefined && previousPrice > 0) {
      const pct = ((currentPrice - previousPrice) / previousPrice) * 100;
      if (Math.abs(pct) >= t.priceMovePct) {
        anomalies.push({
          id: `anomaly-price-${detectedAt}`,
          type: "price_move",
          description: `SOL price ${pct < 0 ? "dropped" : "rose"} ${Math.abs(pct).toFixed(1)}% ($${previousPrice.toFixed(2)} → $${currentPrice.toFixed(2)})`,
          severity: Math.abs(pct) >= 15 ? 3 : Math.abs(pct) >= 10 ? 2 : 1,
          oldValue: previousPrice,
          newValue: currentPrice,
          pctChange: pct,
          evidenceIds: [currentPriceEv.id, previousPriceEv.id],
          detectedAt,
        });
      }
    }
  }

  return anomalies;
}

// ── Helpers ──────────────────────────────────────────────────

function pctChange(metric: MetricChange): number | undefined {
  if (metric.from === undefined || metric.to === undefined || metric.from === 0) return undefined;
  return ((metric.to - metric.from) / metric.from) * 100;
}

function formatNum(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function extractNumber(text: string, keyword: string): number | undefined {
  const regex = new RegExp(`(\\d[\\d,]*)\\s+${keyword}`, "i");
  const match = text.match(regex);
  if (!match) return undefined;
  return parseInt(match[1]!.replace(/,/g, ""), 10);
}

function extractPrice(text: string): number | undefined {
  const match = text.match(/\$([\d,.]+)/);
  if (!match) return undefined;
  return parseFloat(match[1]!.replace(/,/g, ""));
}
