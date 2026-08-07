import type {
  DataProvider,
  ProviderFetch,
  RawProject,
  RawEvidence,
  RawNarrative,
} from "../interfaces/DataProvider";
import type {
  EvidenceCollection,
  EvidenceCollectorConfig,
  EvidenceItem,
  EvidenceSource,
} from "./EvidenceTypes";
import {
  NormalizationRegistry,
  normalizationRegistry,
} from "../normalization/NormalizationRegistry";
import type { CanonicalEvidence } from "../normalization/CanonicalEvidence";

/**
 * EvidenceCollector — gathers raw data from multiple providers, normalizes it,
 * and produces an EvidenceCollection of CanonicalEvidence wrapped as EvidenceItem.
 *
 * Responsibilities:
 * - Accepts a map of provider names to DataProvider instances
 * - Accepts a NormalizationRegistry for normalizing provider payloads
 * - Executes fetchProjects/evidence/narratives on each provider
 * - Normalizes results via NormalizationRegistry into CanonicalEvidence
 * - Wraps CanonicalEvidence into EvidenceItem for the collection
 * - Aggregates results into an EvidenceCollection
 * - Handles provider failures gracefully
 *
 * Does NOT:
 * - Score, rank, or interpret evidence
 * - Filter or transform beyond basic normalization
 */
export class EvidenceCollector {
  private readonly providers: Map<string, DataProvider>;
  private readonly normalizers: NormalizationRegistry;
  private readonly config: Required<{
    timeoutMs: number;
    continueOnFailure: boolean;
  }>;

  constructor(
    providers: Map<string, DataProvider> = new Map(),
    config: EvidenceCollectorConfig = {},
    normalizers?: NormalizationRegistry,
  ) {
    this.providers = providers;
    this.normalizers = normalizers ?? normalizationRegistry;
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
   * Collect raw data from all registered providers and normalize to CanonicalEvidence.
   * Returns an EvidenceCollection with normalized CanonicalEvidence items wrapped as EvidenceItem.
   */
  async collect(): Promise<EvidenceCollection<CanonicalEvidence>> {
    const startTime = Date.now();
    const items: EvidenceCollection<CanonicalEvidence>["items"] = [];
    let providersSucceeded = 0;
    let providersFailed = 0;

    const collectionPromises = Array.from(this.providers.entries()).map(
      async ([providerName, provider]) => {
        try {
          // Fetch projects (primary data source)
          const projectsFetch = await this.withTimeout<ProviderFetch<RawProject>>(
            provider.fetchProjects(),
            `provider ${providerName} fetchProjects`,
          );

          for (const project of projectsFetch.data) {
            const normalized = this.normalizeFromProvider(providerName, project);
            items.push(...normalized);
          }

          // Fetch evidence
          const evidenceFetch = await this.withTimeout<ProviderFetch<RawEvidence>>(
            provider.fetchEvidence(),
            `provider ${providerName} fetchEvidence`,
          );

          for (const evidence of evidenceFetch.data) {
            const normalized = this.normalizeFromProvider(providerName, evidence);
            items.push(...normalized);
          }

          // Fetch narratives
          const narrativesFetch = await this.withTimeout<ProviderFetch<RawNarrative>>(
            provider.fetchNarratives(),
            `provider ${providerName} fetchNarratives`,
          );

          for (const narrative of narrativesFetch.data) {
            const normalized = this.normalizeFromProvider(providerName, narrative);
            items.push(...normalized);
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

  /**
   * Normalize a single raw provider payload using the registry.
   * The providerName is used as the sourceType for normalization routing.
   * Returns CanonicalEvidence wrapped as EvidenceItem.
   */
  private normalizeFromProvider(
    providerName: string,
    rawData: RawProject | RawEvidence | RawNarrative,
  ): EvidenceItem<CanonicalEvidence>[] {
    try {
      // Wrap single item in array for batch normalization
      const result = this.normalizers.normalizeWithErrors(providerName, [rawData]);

      return result.evidence.map((canonical) => this.toEvidenceItem(providerName, canonical));
    } catch (error) {
      // If normalizer throws (e.g., unsupported source), return empty array
      // The collector continues with other providers if continueOnFailure is true
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "UNSUPPORTED_SOURCE"
      ) {
        return [];
      }
      // Re-throw other normalization errors
      throw error;
    }
  }

  /**
   * Convert CanonicalEvidence to EvidenceItem<CanonicalEvidence>.
   */
  private toEvidenceItem(
    providerName: string,
    canonical: CanonicalEvidence,
  ): EvidenceItem<CanonicalEvidence> {
    const source: EvidenceSource = {
      id: canonical.id,
      provider: canonical.sourceId,
      timestamp: canonical.collectedAt,
      endpoint: canonical.metadata.endpoint,
      requestParams: canonical.metadata.requestParams,
    };

    // Determine evidence type from canonical evidenceType or fallback
    const evidenceType = canonical.evidenceType || "raw-project";

    return {
      id: canonical.id,
      type: evidenceType,
      source,
      data: canonical,
      description: canonical.title || `${providerName}: ${canonical.sourceType}`,
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
