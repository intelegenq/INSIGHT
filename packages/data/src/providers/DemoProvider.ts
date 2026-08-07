import type {
  DataProvider,
  ProviderFetch,
  ProviderHealth,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../interfaces/DataProvider";
import { staticFetch, staticHealth, STATIC_AS_OF } from "../interfaces/DataProvider";

/**
 * DemoProvider — the canonical demo ingestion source.
 *
 * Serves the illustrative demo dataset as *raw* records. The transformer
 * layer maps these to core types; the provider itself performs no mapping.
 * Output is byte-for-byte identical to the legacy demo repository after
 * transformation (verified by the integration tests).
 */

const DEMO_PROJECT_RAW: RawProject[] = [
  {
    id: "proj-lending",
    name: "Illustrative Lending Pool",
    category: "defi",
    description:
      "A demo lending protocol whose utilization and TVL are representative of the broader ecosystem pulse.",
    metrics: {
      tvl: 1_240_000_000,
      volume24h: 86_000_000,
      activeUsers24h: 14_200,
      developerActivity: 8,
    },
    evidenceIds: ["evidence-telemetry"],
    updatedAt: "2026-08-06T08:00:00.000Z",
  },
  {
    id: "proj-ormlite",
    name: "Ormlite Compiler",
    category: "infrastructure",
    description: "A demo compiler toolchain tracking developer releases and repository momentum.",
    metrics: {
      tvl: 0,
      volume24h: 0,
      activeUsers24h: 3_100,
      developerActivity: 22,
    },
    evidenceIds: ["evidence-developer"],
    updatedAt: "2026-08-06T08:30:00.000Z",
  },
];

const DEMO_EVIDENCE_RAW: RawEvidence[] = [
  {
    id: "evidence-telemetry",
    sourceId: "source-evidence-telemetry",
    sourceName: "Protocol telemetry",
    note: "Illustrative TVL and lending-activity signal",
    status: "demo",
    observedAt: "2026-08-07T09:40:00.000Z",
    reference: "demo:telemetry:evidence-telemetry",
  },
  {
    id: "evidence-developer",
    sourceId: "source-evidence-developer",
    sourceName: "Developer activity",
    note: "Illustrative release and repository signal",
    status: "demo",
    observedAt: "2026-08-07T09:40:00.000Z",
    reference: "demo:developer:evidence-developer",
  },
  {
    id: "evidence-monitoring",
    sourceId: "source-evidence-monitoring",
    sourceName: "Ecosystem monitoring",
    note: "Illustrative narrative and launch signal",
    status: "demo",
    observedAt: "2026-08-07T09:40:00.000Z",
    reference: "demo:monitoring:evidence-monitoring",
  },
];

const DEMO_NARRATIVE_RAW: RawNarrative[] = [
  {
    id: "narr-defi-liquidity",
    name: "DeFi liquidity",
    tone: "positive",
    change: "+18.4%",
    note: "Borrowing activity and TVL are expanding across the lending stack.",
    projectIds: ["proj-lending"],
    evidenceIds: [],
  },
  {
    id: "narr-consumer-apps",
    name: "Consumer apps",
    tone: "positive",
    change: "+7.2%",
    note: "New launches are bringing more recurring on-chain activity.",
    projectIds: [],
    evidenceIds: [],
  },
  {
    id: "narr-infrastructure",
    name: "Infrastructure",
    tone: "neutral",
    change: "Watch",
    note: "Developer releases are concentrated around performance and data tooling.",
    projectIds: ["proj-ormlite"],
    evidenceIds: [],
  },
];

/** Raw demo data, exported for tests and for repository seeding. */
export const demoRaw = {
  projects: DEMO_PROJECT_RAW,
  evidence: DEMO_EVIDENCE_RAW,
  narratives: DEMO_NARRATIVE_RAW,
  asOf: STATIC_AS_OF,
};

/**
 * DemoProvider — deterministic static provider.
 */
export class DemoProvider implements DataProvider {
  readonly id = "demo";
  readonly name = "Demo provider";

  fetchProjects(): Promise<ProviderFetch<RawProject>> {
    return staticFetch(demoRaw.projects);
  }

  fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    return staticFetch(demoRaw.evidence);
  }

  fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return staticFetch(demoRaw.narratives);
  }

  health(): Promise<ProviderHealth> {
    return staticHealth(this);
  }

  /** Synchronous payload accessor for static seeding. */
  getStaticPayload(): {
    projects: RawProject[];
    evidence: RawEvidence[];
    narratives: RawNarrative[];
  } {
    return demoRaw;
  }
}

/** Shared demo provider instance. */
export const demoProvider = new DemoProvider();
