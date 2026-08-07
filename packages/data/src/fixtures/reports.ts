import type { Report, ReportConfidence, ReportLens } from "@insight/core";
import { demoLensBriefs } from "../sources/demo";
import type { DemoLensBrief } from "../sources/types";

/**
 * Report fixtures.
 *
 * Demo research-lens briefs are normalized into core {@link Report} domain
 * objects so the report studio renders a typed contract, not raw source data.
 */

function toReport(brief: DemoLensBrief, confidence: ReportConfidence): Report {
  return {
    id: `report-${brief.lens}`,
    lens: brief.lens,
    title: brief.title,
    sections: {
      thesis: brief.thesis,
      catalyst: brief.catalyst,
      risk: brief.risk,
    },
    evidenceIds: brief.evidenceIds,
    confidence,
    generatedAt: "2026-08-07T09:40:00.000Z",
    isDemo: true,
  };
}

function requireLensBrief(lens: ReportLens): DemoLensBrief {
  const brief = demoLensBriefs.find((item) => item.lens === lens);
  if (brief === undefined) {
    throw new Error(`Missing demo lens brief: ${lens}`);
  }
  return brief;
}

const ecosystem = toReport(requireLensBrief("ecosystem"), "illustrative");
const defi = toReport(requireLensBrief("defi"), "illustrative");
const infrastructure = toReport(requireLensBrief("infrastructure"), "illustrative");

export const reportByLens: Record<ReportLens, Report> = {
  ecosystem,
  defi,
  infrastructure,
};

export const reports: Report[] = [ecosystem, defi, infrastructure];
