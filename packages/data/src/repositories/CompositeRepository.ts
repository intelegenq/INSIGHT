import type { Evidence, Narrative, Project, Report, ReportLens } from "@insight/core";
import type {
  DataProvider,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../interfaces/DataProvider";
import type { PulseSnapshot, TimelineEvent } from "../sources/types";
import { transformEvidenceList, dedupeEvidence } from "../transformers/evidence";
import { transformProjectList, dedupeProjects } from "../transformers/project";
import { transformNarrativeList, dedupeNarratives } from "../transformers/narrative";
import type { ProjectRepository } from "./projectRepository";

/**
 * CompositeRepository — merges multiple {@link DataProvider}s into a single
 * {@link ProjectRepository}.
 *
 * Conflict resolution is fully deterministic:
 *  - providers are consulted in the order they were supplied,
 *  - duplicate ids are dropped (first provider wins),
 *  - final lists are sorted by id for stable ordering.
 *
 * Transformation happens exclusively in the transformer layer; this class
 * only orchestrates fetch → transform → merge → serve.
 */

/** A static provider that can expose its payload synchronously. */
export interface StaticDataProvider extends DataProvider {
  /** Raw payloads, available without awaiting. */
  getStaticPayload(): {
    projects: RawProject[];
    evidence: RawEvidence[];
    narratives: RawNarrative[];
  };
}

export interface CompositeRepositoryOptions {
  /** Providers to merge, in priority order. */
  providers: DataProvider[];
  /** Optional pulse snapshot served by this repository. */
  pulse?: PulseSnapshot;
  /** Optional timeline served by this repository. */
  timeline?: TimelineEvent[];
  /** Optional pre-authored reports served by this repository. */
  reports?: Report[];
}

export class CompositeRepository implements ProjectRepository {
  private readonly providers: DataProvider[];
  private readonly pulse: PulseSnapshot;
  private readonly timeline: TimelineEvent[];
  private readonly reports: Report[];

  private projects: Project[] = [];
  private evidence: Evidence[] = [];
  private narratives: Narrative[] = [];

  constructor(options: CompositeRepositoryOptions) {
    this.providers = options.providers;
    this.pulse = options.pulse ?? { asOf: "1970-01-01T00:00:00.000Z", metrics: [] };
    this.timeline = options.timeline ?? [];
    this.reports = options.reports ?? [];
  }

  /**
   * Build a composite repository from a single static provider without
   * awaiting (static providers expose their payloads synchronously).
   */
  static fromStatic(
    provider: DataProvider,
    options?: Omit<CompositeRepositoryOptions, "providers">,
  ): CompositeRepository {
    const repository = new CompositeRepository({ ...options, providers: [provider] });
    repository.seedFromStatic(provider);
    return repository;
  }

  /** Load data from all providers (fetch → transform → merge). */
  async load(): Promise<void> {
    const {
      projects: rawProjects,
      evidence: rawEvidence,
      narratives: rawNarratives,
    } = await this.fetchAll();

    this.projects = dedupeProjects(transformProjectList(rawProjects));
    this.evidence = dedupeEvidence(transformEvidenceList(rawEvidence));
    this.narratives = dedupeNarratives(transformNarrativeList(rawNarratives));
  }

  private async fetchAll(): Promise<{
    projects: RawProject[];
    evidence: RawEvidence[];
    narratives: RawNarrative[];
  }> {
    const [projectFetches, evidenceFetches, narrativeFetches] = await Promise.all([
      Promise.all(this.providers.map((provider) => provider.fetchProjects())),
      Promise.all(this.providers.map((provider) => provider.fetchEvidence())),
      Promise.all(this.providers.map((provider) => provider.fetchNarratives())),
    ]);

    return {
      projects: mergeRaw(projectFetches.flatMap((fetch) => fetch.data)),
      evidence: mergeRaw(evidenceFetches.flatMap((fetch) => fetch.data)),
      narratives: mergeRaw(narrativeFetches.flatMap((fetch) => fetch.data)),
    };
  }

  /** Seed from a static provider's synchronous payloads. */
  private seedFromStatic(provider: DataProvider): void {
    if (!isStaticProvider(provider)) {
      throw new Error(
        `Provider "${provider.id}" is not static; use CompositeRepository.load() instead`,
      );
    }
    const raw = provider.getStaticPayload();
    this.projects = dedupeProjects(transformProjectList(raw.projects));
    this.evidence = dedupeEvidence(transformEvidenceList(raw.evidence));
    this.narratives = dedupeNarratives(transformNarrativeList(raw.narratives));
  }

  getPulse(): PulseSnapshot {
    return this.pulse;
  }

  getTimeline(): TimelineEvent[] {
    return this.timeline;
  }

  getProjects(): Project[] {
    return this.projects;
  }

  getProject(projectId: string): Project | undefined {
    return this.projects.find((project) => project.id === projectId);
  }

  getNarratives(): Narrative[] {
    return this.narratives;
  }

  getReports(): Report[] {
    return this.reports;
  }

  getReport(lens: ReportLens): Report | undefined {
    return this.reports.find((report) => report.lens === lens);
  }

  getEvidence(evidenceId: string): Evidence | undefined {
    return this.evidence.find((item) => item.id === evidenceId);
  }

  resolveEvidenceIds(evidenceIds: readonly string[]): Evidence[] {
    const byId = new Map(this.evidence.map((item) => [item.id, item]));
    return evidenceIds
      .map((id) => byId.get(id))
      .filter((item): item is Evidence => item !== undefined);
  }
}

function isStaticProvider(provider: DataProvider): provider is StaticDataProvider {
  return typeof (provider as StaticDataProvider).getStaticPayload === "function";
}

/** Deterministic raw merge: preserve provider order, drop duplicate ids. */
function mergeRaw<T extends { id: string }>(records: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const record of records) {
    if (!seen.has(record.id)) {
      seen.add(record.id);
      result.push(record);
    }
  }
  return result;
}
