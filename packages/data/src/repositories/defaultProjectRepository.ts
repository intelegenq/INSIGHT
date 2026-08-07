import type { ProjectRepository } from "./projectRepository";
import { CompositeRepository } from "./CompositeRepository";
import { demoProvider } from "../providers/DemoProvider";
import { demoPulse, demoTimeline, demoLensBriefs } from "../sources/demo";
import { transformReport } from "../transformers/report";
import type { RawReportBrief } from "../transformers/report";

/**
 * Default project repository.
 *
 * Backed by the {@link DemoProvider}, this instance is served to the runtime
 * and web app through the shared `ProjectRepository` contract. Its output is
 * identical to the legacy demo repository: data flows through the
 * transformer layer (the only mapping point) and mirrors the demo pulse,
 * timeline, and authored reports.
 */

/** Build the default demo report set through the report transformer. */
function demoReportBriefs(): RawReportBrief[] {
  return demoLensBriefs.map((brief) => ({
    id: `report-${brief.lens}`,
    lens: brief.lens,
    title: brief.title,
    sections: { thesis: brief.thesis, catalyst: brief.catalyst, risk: brief.risk },
    evidenceIds: brief.evidenceIds,
    confidence: "illustrative",
    generatedAt: "2026-08-07T09:40:00.000Z",
    isDemo: true,
  }));
}

/**
 * The canonical demo repository, ready to serve synchronously. Built via
 * {@link CompositeRepository.fromStatic} so it is seeded from the demo
 * provider while carrying the demo pulse, timeline, and authored reports.
 */
export const projectRepository: ProjectRepository = CompositeRepository.fromStatic(demoProvider, {
  pulse: demoPulse,
  timeline: demoTimeline,
  reports: demoReportBriefs().map(transformReport),
});
