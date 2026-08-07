/**
 * @insight/runtime/history — HistoryAnalyzer.
 *
 * Deterministic comparison between two {@link import("../snapshot").Snapshot}
 * records. Produces per-project and per-narrative change records plus an
 * aggregate summary.
 *
 * No predictions, no AI calls, no randomness. Every output field is a pure
 * function of the two input snapshots.
 */

import type { NarrativeTrend, ProjectMetrics } from "@insight/core";
import type { Snapshot } from "../snapshot";
import type {
  ChangeDirection,
  HistoryDiff,
  NarrativeChange,
  ProjectChange,
  ProjectMetricChange,
} from "./HistoryTypes";

const TREND_RANK: Record<NarrativeTrend, number> = {
  up: 3,
  flat: 2,
  watch: 1,
  down: 0,
};

export class HistoryAnalyzer {
  /** Compare two snapshots and produce a deterministic diff. */
  compare(older: Snapshot, newer: Snapshot): HistoryDiff {
    const projectChanges = diffProjects(older, newer);
    const narrativeChanges = diffNarratives(older, newer);
    const summary = buildSummary(older, newer, projectChanges, narrativeChanges);
    return {
      fromId: older.id,
      toId: newer.id,
      fromReferenceDate: older.referenceDate,
      toReferenceDate: newer.referenceDate,
      projects: projectChanges,
      narratives: narrativeChanges,
      summary,
    };
  }
}

function diffProjects(older: Snapshot, newer: Snapshot): ProjectChange[] {
  const olderById = new Map(older.projects.map((p) => [p.id, p]));
  const newerById = new Map(newer.projects.map((p) => [p.id, p]));
  const allIds = new Set<string>([...olderById.keys(), ...newerById.keys()]);

  const changes: ProjectChange[] = [];
  for (const id of allIds) {
    const previous = olderById.get(id);
    const current = newerById.get(id);

    if (previous === undefined || current === undefined) {
      // Newly added or removed projects are summarized separately.
      continue;
    }

    const metricChanges = diffMetrics(previous.metrics, current.metrics);
    const descriptionChanged = previous.description !== current.description;
    if (metricChanges.length === 0 && !descriptionChanged) {
      continue;
    }

    changes.push({
      projectId: id,
      name: current.name ?? previous.name ?? id,
      category: current.category,
      metrics: metricChanges,
      descriptionChanged,
    });
  }

  return changes.sort((a, b) => a.projectId.localeCompare(b.projectId));
}

function diffMetrics(
  previous: ProjectMetrics,
  current: ProjectMetrics,
): ProjectMetricChange[] {
  const keys = new Set<string>([
    ...Object.keys(previous),
    ...Object.keys(current),
  ]);
  const out: ProjectMetricChange[] = [];
  for (const key of [...keys].sort()) {
    const from = previous[key as keyof ProjectMetrics];
    const to = current[key as keyof ProjectMetrics];
    if (from === to) {
      continue;
    }
    const hasFrom = typeof from === "number";
    const hasTo = typeof to === "number";
    const delta = hasFrom && hasTo ? (to as number) - (from as number) : undefined;
    const direction: ChangeDirection =
      delta === undefined
        ? "unchanged"
        : delta > 0
          ? "increased"
          : delta < 0
            ? "decreased"
            : "unchanged";
    out.push({
      metric: key,
      from: hasFrom ? (from as number) : undefined,
      to: hasTo ? (to as number) : undefined,
      delta,
      direction,
    });
  }
  return out;
}

function diffNarratives(older: Snapshot, newer: Snapshot): NarrativeChange[] {
  const olderById = new Map(older.narratives.map((n) => [n.id, n]));
  const newerById = new Map(newer.narratives.map((n) => [n.id, n]));
  const allIds = new Set<string>([...olderById.keys(), ...newerById.keys()]);

  const changes: NarrativeChange[] = [];
  for (const id of allIds) {
    const previous = olderById.get(id);
    const current = newerById.get(id);

    const fromTrend = previous?.trend;
    const toTrend = current?.trend;
    const noteChanged = (previous?.note ?? "") !== (current?.note ?? "");

    let trendChange: NarrativeChange["trendChange"];
    if (previous === undefined && current !== undefined) {
      trendChange = "appeared";
    } else if (previous !== undefined && current === undefined) {
      trendChange = "disappeared";
    } else if (fromTrend === toTrend) {
      trendChange = noteChanged ? "trend-stable" : "trend-stable";
    } else {
      trendChange = "trend-shifted";
    }

    if (!noteChanged && trendChange === "trend-stable" && fromTrend === toTrend) {
      continue;
    }

    changes.push({
      narrativeId: id,
      name: current?.name ?? previous?.name ?? id,
      fromTrend,
      toTrend,
      trendChange,
      noteChanged,
    });
  }

  return changes.sort((a, b) => a.narrativeId.localeCompare(b.narrativeId));
}

function buildSummary(
  older: Snapshot,
  newer: Snapshot,
  projectChanges: ProjectChange[],
  narrativeChanges: NarrativeChange[],
): HistoryDiff["summary"] {
  const olderProjectIds = new Set(older.projects.map((p) => p.id));
  const newerProjectIds = new Set(newer.projects.map((p) => p.id));
  let addedProjects = 0;
  let removedProjects = 0;
  let commonProjects = 0;
  for (const id of newerProjectIds) {
    if (olderProjectIds.has(id)) {
      commonProjects += 1;
    } else {
      addedProjects += 1;
    }
  }
  for (const id of olderProjectIds) {
    if (!newerProjectIds.has(id)) {
      removedProjects += 1;
    }
  }

  return {
    addedProjects,
    removedProjects,
    commonProjects,
    changedProjects: projectChanges.length,
    changedNarratives: narrativeChanges.length,
  };
}

/** Rank a narrative trend numerically (used only by callers that want a magnitude). */
export function trendRank(trend: NarrativeTrend): number {
  return TREND_RANK[trend];
}