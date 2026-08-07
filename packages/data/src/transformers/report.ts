import type { Report, ReportConfidence, ReportLens, ReportSections } from "@insight/core";

/**
 * Report transformer.
 *
 * Raw report/lens-brief records are mapped to core {@link Report}. The demo
 * fixture already stores complete reports, so this mostly normalizes the
 * contract; providers can produce authored briefs through the same path.
 */

export interface RawReportBrief {
  id: string;
  lens: ReportLens;
  title: string;
  sections: ReportSections;
  evidenceIds: string[];
  confidence: ReportConfidence;
  generatedAt: string;
  isDemo: boolean;
}

const VALID_LENS: readonly ReportLens[] = ["ecosystem", "defi", "infrastructure"];
const VALID_CONFIDENCE: readonly ReportConfidence[] = ["illustrative", "draft", "medium", "high"];

/** Validate and normalize a report lens. */
export function normalizeLens(value: string): ReportLens {
  if ((VALID_LENS as readonly string[]).includes(value)) {
    return value as ReportLens;
  }
  return "ecosystem";
}

/** Validate and normalize a report confidence label. */
export function normalizeConfidence(value: string): ReportConfidence {
  if ((VALID_CONFIDENCE as readonly string[]).includes(value)) {
    return value as ReportConfidence;
  }
  return "illustrative";
}

/** Map a raw report brief to a core {@link Report}. */
export function transformReport(raw: RawReportBrief): Report {
  return {
    id: raw.id,
    lens: normalizeLens(raw.lens),
    title: raw.title,
    sections: {
      thesis: raw.sections.thesis ?? "",
      catalyst: raw.sections.catalyst,
      risk: raw.sections.risk,
    },
    evidenceIds: raw.evidenceIds ?? [],
    confidence: normalizeConfidence(raw.confidence),
    generatedAt: raw.generatedAt,
    isDemo: raw.isDemo,
  };
}

/** Convenience: map a report brief with inferred settings. */
export function demoReport(target: {
  id: string;
  lens: ReportLens;
  title: string;
  sections: ReportSections;
  evidenceIds: string[];
}): Report {
  return transformReport({
    ...target,
    confidence: "illustrative",
    generatedAt: "1970-01-01T00:00:00.000Z",
    isDemo: true,
  });
}
