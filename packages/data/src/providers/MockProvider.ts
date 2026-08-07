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
 * MockProvider — a deterministic test-only provider.
 *
 * Supplies a small, distinct dataset so integration tests can verify
 * composite merging, conflict resolution, and provider swapping. It is not
 * used in production paths.
 */

const MOCK_PROJECT_RAW: RawProject[] = [
  {
    id: "mock-stable-swap",
    name: "Stable Swap",
    category: "defi",
    description: "A mock AMM for testing the ingestion foundation.",
    metrics: { tvl: 25_000_000, volume24h: 9_000_000, activeUsers24h: 4_000, developerActivity: 4 },
    evidenceIds: ["mock-evidence-swap"],
    updatedAt: "2026-08-05T10:00:00.000Z",
  },
];

const MOCK_EVIDENCE_RAW: RawEvidence[] = [
  {
    id: "mock-evidence-swap",
    sourceId: "source-mock-swap",
    sourceName: "Mock swap telemetry",
    note: "Illustrative AMM volume signal for tests",
    status: "verified",
    observedAt: "2026-08-06T11:00:00.000Z",
    reference: "mock:swap:mock-evidence-swap",
  },
];

const MOCK_NARRATIVE_RAW: RawNarrative[] = [
  {
    id: "mock-narrative-amm",
    name: "AMM innovation",
    tone: "neutral",
    change: "Watch",
    note: "A mock narrative used only to validate provider merging.",
    projectIds: ["mock-stable-swap"],
    evidenceIds: ["mock-evidence-swap"],
  },
];

/** Raw mock data, exported for tests and repository seeding. */
export const mockRaw = {
  projects: MOCK_PROJECT_RAW,
  evidence: MOCK_EVIDENCE_RAW,
  narratives: MOCK_NARRATIVE_RAW,
  asOf: STATIC_AS_OF,
};

/**
 * MockProvider — deterministic static test provider.
 */
export class MockProvider implements DataProvider {
  readonly id = "mock";
  readonly name = "Mock provider";

  fetchProjects(): Promise<ProviderFetch<RawProject>> {
    return staticFetch(mockRaw.projects);
  }

  fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    return staticFetch(mockRaw.evidence);
  }

  fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return staticFetch(mockRaw.narratives);
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
    return mockRaw;
  }
}

/** Shared mock provider instance. */
export const mockProvider = new MockProvider();
