import type {
  DataProvider,
  ProviderFetch,
  RawProject,
  RawEvidence,
  RawNarrative,
} from "../interfaces/DataProvider";
import type { EvidenceCollection, EvidenceCollectorConfig } from "./EvidenceTypes";

/**
 * EvidenceCollector — gathers raw data from multiple providers and produces an EvidenceCollection.
 *
 * Responsibilities:
 * - Accepts a map of provider names to DataProvider instances
 * - Executes fetchProjects/evidence/narratives on each provider
 * - Aggregates results into an EvidenceCollection
 * - Handles provider failures gracefully
 *
 * Does NOT:
 * - Score, rank, or interpret evidence
 * - Filter or transform beyond basic wrapping
 */
export class EvidenceCollector {
  private readonly providers: Map<string, DataProvider>;
  private readonly config: Required<{
    timeoutMs: number;
    continueOnFailure: boolean;
  }>;

  constructor(
    providers: Map<string, DataProvider> = new Map(),
    config: EvidenceCollectorConfig = {},
  ) {
    this.providers = providers;
    this.config = {
      timeoutMs: config.timeoutMs ?? 30_000,
      continueOnFailure: config.continueOnFailure ?? true,
    };
  }

  /** Register a provider for collection. */
  addProvider(name: string, provider: DataProvider): this {
    this.providers.set(name, provider);
    return this;
  }

  /** Remove a provider. */
  removeProvider(name: string): this {
    this.providers.delete(name);
    return this;
  }

  /** Get all registered provider names. */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Collect raw data from all registered providers.
   * Returns an EvidenceCollection with raw data wrapped as EvidenceItem.
   */
  async collect(): Promise<EvidenceCollection<unknown>> {
    const startTime = Date.now();
    const items: EvidenceCollection<unknown>["items"] = [];
    let providersSucceeded = 0;
    let providersFailed = 0;

    const collectionPromises = Array.from(this.providers.entries()).map(
      async ([providerName, provider]) => {
        try {
          // Fetch projects (primary data source for now)
          const projectsFetch = await this.withTimeout<ProviderFetch<RawProject>>(
            provider.fetchProjects(),
            `provider ${providerName} fetchProjects`,
          );

          for (const project of projectsFetch.data) {
            items.push({
              id: `${providerName}-${project.id}`,
              type: "project",
              source: {
                id: `${providerName}-${project.id}`,
                provider: providerName,
                timestamp: Date.now(),
                endpoint: "fetchProjects",
              },
              data: project,
              description: `${providerName} project: ${project.name}`,
            });
          }

          // Fetch evidence (stub for now)
          const evidenceFetch = await this.withTimeout<ProviderFetch<RawEvidence>>(
            provider.fetchEvidence(),
            `provider ${providerName} fetchEvidence`,
          );

          for (const evidence of evidenceFetch.data) {
            items.push({
              id: `${providerName}-evidence-${evidence.id}`,
              type: "evidence",
              source: {
                id: `${providerName}-evidence-${evidence.id}`,
                provider: providerName,
                timestamp: Date.now(),
                endpoint: "fetchEvidence",
              },
              data: evidence,
              description: `${providerName} evidence`,
            });
          }

          // Fetch narratives (stub for now)
          const narrativesFetch = await this.withTimeout<ProviderFetch<RawNarrative>>(
            provider.fetchNarratives(),
            `provider ${providerName} fetchNarratives`,
          );

          for (const narrative of narrativesFetch.data) {
            items.push({
              id: `${providerName}-narrative-${narrative.id}`,
              type: "narrative",
              source: {
                id: `${providerName}-narrative-${narrative.id}`,
                provider: providerName,
                timestamp: Date.now(),
                endpoint: "fetchNarratives",
              },
              data: narrative,
              description: `${providerName} narrative`,
            });
          }

          providersSucceeded++;
        } catch (error) {
          providersFailed++;
          if (!this.config.continueOnFailure) {
            throw error;
          }
        }
      },
    );

    await Promise.all(collectionPromises);

    const durationMs = Date.now() - startTime;

    return {
      timestamp: startTime,
      items,
      metadata: {
        providersQueried: this.providers.size,
        providersSucceeded,
        providersFailed,
        durationMs,
      },
    };
  }

  /** Helper to add timeout to a promise. */
  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timed out after ${this.config.timeoutMs}ms`)),
          this.config.timeoutMs,
        ),
      ),
    ]);
  }
}
