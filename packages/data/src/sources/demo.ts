import type {
  DemoEvidenceSource,
  DemoLensBrief,
  DemoNarrativeSource,
  PulseSnapshot,
  TimelineEvent,
} from "./types";

/**
 * Demo data source.
 *
 * The MVP intentionally runs without live collectors or external APIs. This
 * module centralizes the illustrative dataset so the web app never embeds
 * raw demo content directly. It is clearly labeled as demo throughout.
 */

/** Headline metrics for the ecosystem pulse dashboard. */
export const demoPulse: PulseSnapshot = {
  asOf: "07 Aug 2026",
  metrics: [
    {
      id: "signals-reviewed",
      label: "Signals reviewed",
      value: "24",
      caption: "Illustrative events across on-chain and off-chain sources",
    },
    {
      id: "emerging-narratives",
      label: "Emerging narratives",
      value: "03",
      caption: "Detected themes awaiting source-backed scoring",
    },
    {
      id: "research-confidence",
      label: "Research confidence",
      value: "—",
      caption: "Available once connected sources and evaluation rules are live",
      variant: "violet",
    },
  ],
};

/** Research timeline entries. */
export const demoTimeline: TimelineEvent[] = [
  {
    id: "evt-liquidity",
    time: "09:40 UTC",
    title: "Liquidity momentum strengthens across leading protocols",
    source: "Demo signal",
    confidence: "Illustrative",
  },
  {
    id: "evt-infrastructure",
    time: "08:15 UTC",
    title: "Developer activity points to renewed infrastructure focus",
    source: "Demo signal",
    confidence: "Illustrative",
  },
  {
    id: "evt-pulse",
    time: "06:30 UTC",
    title: "Solana ecosystem pulse prepared for review",
    source: "Insight",
    confidence: "Draft",
  },
];

/** Narratives surfaced by the demo source. */
export const demoNarratives: DemoNarrativeSource[] = [
  {
    id: "narr-defi-liquidity",
    name: "DeFi liquidity",
    change: "+18.4%",
    note: "Borrowing activity and TVL are expanding across the lending stack.",
    tone: "positive",
  },
  {
    id: "narr-consumer-apps",
    name: "Consumer apps",
    change: "+7.2%",
    note: "New launches are bringing more recurring on-chain activity.",
    tone: "positive",
  },
  {
    id: "narr-infrastructure",
    name: "Infrastructure",
    change: "Watch",
    note: "Developer releases are concentrated around performance and data tooling.",
    tone: "neutral",
  },
];

/** Evidence records shown alongside generated memos. */
export const demoEvidence: DemoEvidenceSource[] = [
  {
    id: "evidence-telemetry",
    source: "Protocol telemetry",
    note: "Illustrative TVL and lending-activity signal",
    status: "demo",
  },
  {
    id: "evidence-developer",
    source: "Developer activity",
    note: "Illustrative release and repository signal",
    status: "demo",
  },
  {
    id: "evidence-monitoring",
    source: "Ecosystem monitoring",
    note: "Illustrative narrative and launch signal",
    status: "demo",
  },
];

/** Research-lens briefs for the report studio. */
export const demoLensBriefs: DemoLensBrief[] = [
  {
    lens: "ecosystem",
    title: "Solana ecosystem pulse",
    thesis:
      "Liquidity and consumer activity are the strongest illustrative signals in this demo snapshot.",
    catalyst:
      "Protocol launches and lending demand could reinforce attention around the ecosystem.",
    risk: "These signals are illustrative; live collection and source validation are not active yet.",
    evidenceIds: ["evidence-telemetry", "evidence-developer", "evidence-monitoring"],
  },
  {
    lens: "defi",
    title: "Solana DeFi brief",
    thesis:
      "The demo points to a constructive liquidity backdrop, led by lending and capital efficiency.",
    catalyst: "Higher utilization and new collateral routes would be the next signals to validate.",
    risk: "TVL and volume movements need source-backed context before they support a conclusion.",
    evidenceIds: ["evidence-telemetry"],
  },
  {
    lens: "infrastructure",
    title: "Solana infrastructure brief",
    thesis: "Developer activity suggests continued attention on performance and data tooling.",
    catalyst:
      "Shipping milestones and adoption by consumer applications would strengthen the case.",
    risk: "Repository activity alone is not a reliable proxy for real adoption.",
    evidenceIds: ["evidence-developer", "evidence-monitoring"],
  },
];
