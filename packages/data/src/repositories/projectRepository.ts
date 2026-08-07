import type { Evidence, Narrative, Project, Report, ReportLens } from "@insight/core";
import type { PulseSnapshot, TimelineEvent } from "../sources/types";

/**
 * ProjectRepository — the repository contract consumed by the runtime and
 * web app.
 *
 * This interface is the stable boundary: runtime depends only on this type
 * and never on a specific provider. Implementations (e.g.
 * {@link import("./CompositeRepository").CompositeRepository}) decide how
 * data is acquired, transformed, cached, and merged.
 */
export interface ProjectRepository {
  getPulse(): PulseSnapshot;
  getTimeline(): TimelineEvent[];
  getProjects(): Project[];
  getProject(projectId: string): Project | undefined;
  getNarratives(): Narrative[];
  getReports(): Report[];
  getReport(lens: ReportLens): Report | undefined;
  getEvidence(evidenceId: string): Evidence | undefined;
  resolveEvidenceIds(evidenceIds: readonly string[]): Evidence[];
}
