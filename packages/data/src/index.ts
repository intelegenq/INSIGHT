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
