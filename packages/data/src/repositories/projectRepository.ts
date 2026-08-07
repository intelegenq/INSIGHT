import type { Evidence, Narrative, Project, Report, ReportLens } from "@insight/core";
import { evidenceByTopic, projectById } from "../fixtures/projects";
import { narratives } from "../fixtures/narratives";
import { reportByLens } from "../fixtures/reports";
import { demoPulse, demoTimeline } from "../sources/demo";
import type { PulseSnapshot, TimelineEvent } from "../sources/types";

/**
 * Project repository.
 *
 * The single typed boundary through which the web app reads intelligence
 * data. The app never imports fixtures or raw sources directly — it asks
 * this repository for normalized domain objects.
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

/** Deterministic in-memory repository backed by demo fixtures. */
export class DemoProjectRepository implements ProjectRepository {
  getPulse(): PulseSnapshot {
    return demoPulse;
  }

  getTimeline(): TimelineEvent[] {
    return demoTimeline;
  }

  getProjects(): Project[] {
    return Object.values(projectById);
  }

  getProject(projectId: string): Project | undefined {
    return projectById[projectId];
  }

  getNarratives(): Narrative[] {
    return narratives;
  }

  getReports(): Report[] {
    return Object.values(reportByLens);
  }

  getReport(lens: ReportLens): Report | undefined {
    return reportByLens[lens];
  }

  getEvidence(evidenceId: string): Evidence | undefined {
    return Object.values(evidenceByTopic).find((item) => item.id === evidenceId);
  }

  resolveEvidenceIds(evidenceIds: readonly string[]): Evidence[] {
    return evidenceIds
      .map((id) => this.getEvidence(id))
      .filter((item): item is Evidence => item !== undefined);
  }
}

/** Shared repository instance used across the web app. */
export const projectRepository: ProjectRepository = new DemoProjectRepository();
