/**
 * @insight/data — intelligence data layer.
 *
 * Separates data sources from the web app. Consumes @insight/core domain
 * types only; never imports React or performs network I/O. The web app
 * receives all intelligence data through {@link projectRepository}.
 */

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

export { projects, projectById, evidenceByTopic } from "./fixtures/projects";
export { narratives } from "./fixtures/narratives";
export { reports, reportByLens } from "./fixtures/reports";

export { DemoProjectRepository, projectRepository } from "./repositories/projectRepository";
export type { ProjectRepository } from "./repositories/projectRepository";
