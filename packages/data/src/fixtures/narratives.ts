import type { Narrative, NarrativeTrend } from "@insight/core";
import { demoNarratives } from "../sources/demo";
import type { DemoNarrativeSource, DemoNarrativeTone } from "../sources/types";

/**
 * Narrative fixtures.
 *
 * Demo narrative records are normalized into core {@link Narrative} domain
 * objects, mapping the source's directional tone to a {@link NarrativeTrend}.
 */
function toneToTrend(tone: DemoNarrativeTone): NarrativeTrend {
  switch (tone) {
    case "positive":
      return "up";
    case "neutral":
      return "watch";
  }
}

function toNarrative(source: DemoNarrativeSource, projectId?: string): Narrative {
  return {
    id: source.id,
    name: source.name,
    trend: toneToTrend(source.tone),
    change: source.change,
    note: source.note,
    projectIds: projectId ? [projectId] : [],
    evidenceIds: [],
  };
}

function requireNarrative(id: string): DemoNarrativeSource {
  const source = demoNarratives.find((item) => item.id === id);
  if (source === undefined) {
    throw new Error(`Missing demo narrative source: ${id}`);
  }
  return source;
}

export const narratives: Narrative[] = [
  toNarrative(requireNarrative("narr-defi-liquidity"), "proj-lending"),
  toNarrative(requireNarrative("narr-consumer-apps")),
  toNarrative(requireNarrative("narr-infrastructure"), "proj-ormlite"),
];
