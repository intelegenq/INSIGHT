/**
 * @insight/data — intelligence data layer.
 *
 * Production-ready ingestion foundation: providers acquire raw data,
 * transformers map it to core types, cache stores transient values, and
 * repositories serve domain objects. The runtime depends only on the
 * repository interface — never on a specific provider.
 */

/* ── Source types & demo source data (legacy demo surface) ─────────── */
export type {
  DemoEvidenceSource,
  DemoLensBrief,
  DemoNarrativeSource,
  DemoNarrativeTone,
  PulseMetric,
  PulseSnapshot,
  TimelineEvent,
} from "./sources/types";

export {
  demoEvidence,
  demoLensBriefs,
  demoNarratives,
  demoPulse,
  demoTimeline,
} from "./sources/demo";

/* ── Fixtures (legacy demo domain objects, kept for compatibility) ─── */
export { projects, projectById, evidenceByTopic } from "./fixtures/projects";
export { narratives } from "./fixtures/narratives";
export { reports, reportByLens } from "./fixtures/reports";

/* ── Repository contract & default instance ────────────────────────── */
export type { ProjectRepository } from "./repositories/projectRepository";
export { projectRepository } from "./repositories/defaultProjectRepository";
export { CompositeRepository } from "./repositories/CompositeRepository";
export type {
  CompositeRepositoryOptions,
  StaticDataProvider,
} from "./repositories/CompositeRepository";

/* ── Provider layer ─────────────────────────────────────────────────── */
export type {
  DataProvider,
  ProviderFetch,
  ProviderHealth,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "./interfaces/DataProvider";
export { STATIC_AS_OF, staticFetch, staticHealth } from "./interfaces/DataProvider";

export { DemoProvider, demoProvider, demoRaw } from "./providers/DemoProvider";
export { MockProvider, mockProvider, mockRaw } from "./providers/MockProvider";

/* ── Provider SDK (base infrastructure) ─────────────────────────────── */
export { BaseProvider } from "./providers/base/BaseProvider";
export type { BaseProviderOptions } from "./providers/base/BaseProvider";

export { HttpClient, fetchTransport } from "./providers/base/HttpClient";
export type { HttpTransport, HttpResponse } from "./providers/base/HttpClient";

export {
  computeBackoff,
  shouldRetry,
  retrySchedule,
  RetryPolicy,
  DEFAULT_RETRY_CONFIG,
} from "./providers/base/RetryPolicy";
export type { RetryConfig } from "./providers/base/RetryPolicy";

export { RateLimiter, validateRateLimitConfig, defaultClock } from "./providers/base/RateLimiter";
export type { RateLimitConfig, Clock, TokensResult } from "./providers/base/RateLimiter";

export { serializeQuery, resolveUrl } from "./providers/base/RequestOptions";
export type {
  HttpClientConfig,
  HttpMethod,
  RequestOptions,
  RequestQuery,
} from "./providers/base/RequestOptions";

export { HeliusProvider } from "./providers/helius/HeliusProvider";
export type { HeliusConfig } from "./providers/helius/HeliusProvider";

export { SolanaRPCProvider } from "./providers/solana/SolanaRPCProvider";
export type {
  SolanaRPCConfig,
  RawSolanaAccount,
  RawProgramData,
} from "./providers/solana/SolanaRPCProvider";

export { DefiLlamaProvider } from "./providers/defillama/DefiLlamaProvider";
export type {
  DefiLlamaConfig,
  RawDefiLlamaProtocol,
} from "./providers/defillama/DefiLlamaProvider";

export { CoinGeckoProvider } from "./providers/coingecko/CoinGeckoProvider";
export type {
  CoinGeckoConfig,
  RawCoinGeckoMarketAsset,
} from "./providers/coingecko/CoinGeckoProvider";

export { MockHttpClient } from "./providers/mock/MockHttpClient";
export type { MockHandler, MockResponse } from "./providers/mock/MockHttpClient";

/* ── M29: Production provider wiring (environment-backed) ───────────── */
export { resolveProductionProviders, hasLiveProviders } from "./providers/ProductionProviders";
export type {
  ProviderEnv,
  ProductionProviderConfig,
  TransportFactory,
} from "./providers/ProductionProviders";

/* ── Evidence layer ───────────────────────────────────────────────────── */
export { EvidenceCollector } from "./evidence/EvidenceCollector";
export { EvidenceNormalizer } from "./evidence/EvidenceNormalizer";
export type {
  EvidenceSource,
  EvidenceItem,
  EvidenceCollection,
  EvidenceCollectorConfig,
  NormalizeResult,
} from "./evidence/EvidenceTypes";

/* ── Source health monitoring ────────────────────────────────────────── */
export { SourceHealthMonitor, checkSourceHealth } from "./monitoring/SourceHealthMonitor";
export type {
  SourceHealthEntry,
  SourceHealthMonitorOptions,
  SourceHealthReport,
  SourceHealthStatus,
} from "./monitoring/SourceHealthMonitor";

/* ── M28: Multi-chain health gating (adapter over SourceHealthMonitor) ── */
export { chainHealthGates, isChainEnabled, chainForProvider } from "./evidence/ChainHealth";
export type { ChainHealthGate } from "./evidence/ChainHealth";

/* ── Normalization layer ──────────────────────────────────────────────── */
export {
  isCanonicalEvidence,
  createCanonicalEvidence,
  createSourceMetadata,
  isSourceMetadata,
  BaseNormalizer,
  normalizeWithErrors,
  NormalizationRegistry,
  normalizationRegistry,
  NormalizationError,
  UnsupportedSourceError,
  InvalidPayloadError,
  MissingRequiredFieldError,
  SchemaMismatchError,
  isNormalizationError,
  isUnsupportedSourceError,
  isInvalidPayloadError,
  isMissingRequiredFieldError,
  isSchemaMismatchError,
} from "./normalization";

/* ── Transformer layer (the only place raw → core mapping happens) ─── */
export {
  dedupeEvidence,
  pickBestEvidence,
  transformEvidence,
  transformEvidenceList,
} from "./transformers/evidence";
export {
  dedupeProjects,
  pickFirstProject,
  transformProject,
  transformProjectList,
} from "./transformers/project";
export {
  dedupeNarratives,
  transformNarrative,
  transformNarrativeList,
} from "./transformers/narrative";
export {
  demoReport,
  normalizeConfidence,
  normalizeLens,
  transformReport,
} from "./transformers/report";
export type { RawReportBrief } from "./transformers/report";

/* ── Cache layer ────────────────────────────────────────────────────── */
export { MemoryCache } from "./cache/MemoryCache";
export { DEFAULT_CACHE_POLICY, policy } from "./cache/CachePolicy";
export type { CachePolicy } from "./cache/CachePolicy";

/* ── Repository factory (provider switching point) ──────────────────── */
export {
  RepositoryFactory,
  createRepository,
  createStaticRepository,
} from "./interfaces/RepositoryFactory";
export type { ProviderKey, RepositoryFactoryOptions } from "./interfaces/RepositoryFactory";
