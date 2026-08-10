import type { Evidence, Narrative, Project } from "@insight/core";

/**
 * DataProvider — the boundary every ingestion source implements.
 *
 * A provider is purely responsible for *acquiring* data (RPC, REST, file,
 * in-memory fixture, ...) and returning it in a raw, normalized-neutral
 * shape. It performs NO mapping to core types — that is the transformer's
 * job. Providers are interchangeable via the repository factory.
 *
 * All methods are async but must remain deterministic from the consumer's
 * perspective (a provider returning static data resolves to the same value
 * every call).
 */

/** Raw, provider-neutral project record (pre-transformation). */
export interface RawProject {
  id: string;
  name: string;
  category: string;
  description?: string;
  metrics?: {
    tvl?: number;
    volume24h?: number;
    activeUsers24h?: number;
    developerActivity?: number;
  };
  evidenceIds?: string[];
  /** ISO-8601 timestamp of the last project update. */
  updatedAt?: string;
  /** Entity classification — distinguishes ecosystem projects from CEXs/network. */
  classification?: string;
  /** Sources that contributed to this project record. */
  sources?: string[];
  /** Project logo URL from data source (DeFiLlama, CoinGecko, etc.) */
  logoUrl?: string;
  /** Protocol slug for historical data fetching */
  slug?: string;
  /** Token symbol (e.g. JUP, RAY) */
  symbol?: string;
  /** 24h change percentage */
  change24h?: number;
  /** 7d change percentage */
  change7d?: number;
  /** 30d change percentage */
  change30d?: number;
  /** Website URL */
  website?: string;
  /** Twitter handle */
  twitter?: string;
  /** GitHub URL */
  github?: string;
}

/** Raw, provider-neutral evidence record (pre-transformation). */
export interface RawEvidence {
  id: string;
  sourceId?: string;
  sourceName?: string;
  note?: string;
  status?: string;
  observedAt?: string;
  reference?: string;
}

/** Raw, provider-neutral narrative record (pre-transformation). */
export interface RawNarrative {
  id: string;
  name: string;
  /** Directional tone; transformers may map it to a core trend. */
  tone?: "positive" | "neutral" | "negative";
  trend?: string;
  change?: string;
  note?: string;
  projectIds?: string[];
  evidenceIds?: string[];
}

/** Health report for a data provider. */
export interface ProviderHealth {
  /** Stable provider id. */
  id: string;
  /** Provider display name. */
  name: string;
  /** True when the provider can supply data. */
  available: boolean;
  /** Provider-reported latency or freshness note. */
  note?: string;
}

/** Result envelope from a provider fetch. */
export interface ProviderFetch<T> {
  /** Raw payload (untransformed). */
  data: T[];
  /** Stable checkpoint/timestamp associated with this payload. */
  asOf: string;
}

/** Deterministic zero-timestamp used by static providers. */
export const STATIC_AS_OF = "1970-01-01T00:00:00.000Z";

/**
 * DataProvider contract. Implementations handle acquisition only.
 * Every method returns untransformed raw records for the transformer layer.
 */
export interface DataProvider {
  /** Stable machine-readable identifier, e.g. "demo" or "mock". */
  readonly id: string;
  /** Human-readable provider name. */
  readonly name: string;
  /** Fetch raw projects. */
  fetchProjects(): Promise<ProviderFetch<RawProject>>;
  /** Fetch raw evidence. */
  fetchEvidence(): Promise<ProviderFetch<RawEvidence>>;
  /** Fetch raw narratives. */
  fetchNarratives(): Promise<ProviderFetch<RawNarrative>>;
  /** Report provider availability and status. */
  health(): Promise<ProviderHealth>;
}

/** Deterministic helper: wrap a static payload as a provider fetch. */
export function staticFetch<T>(data: T[]): Promise<ProviderFetch<T>> {
  return Promise.resolve({ data, asOf: STATIC_AS_OF });
}

/** Deterministic health envelope for a static provider. */
export function staticHealth(provider: Pick<DataProvider, "id" | "name">): Promise<ProviderHealth> {
  return Promise.resolve({
    id: provider.id,
    name: provider.name,
    available: true,
    note: "static provider",
  });
}

/* Core domain re-exports kept for ergonomic repository typing. */
export type { Evidence, Narrative, Project } from "@insight/core";
