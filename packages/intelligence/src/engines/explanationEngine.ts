import type { Evidence, Project, Narrative, Report, ReportLens } from "@insight/core";
import type { ScoredProject, DerivedNarrative, ProjectHealth } from "../types";

/**
 * ExplanationEngine — generates human-readable explanations for intelligence outputs.
 *
 * Pure functions only: no I/O, no randomness, no wall-clock reads.
 * Every explanation is derived solely from its inputs for reproducibility.
 */

/**
 * Explain a project's health profile with human-readable reasoning.
 */
export function explainProjectHealth(
  project: Project,
  health: ProjectHealth,
  evidence: readonly Evidence[],
): string[] {
  const reasons: string[] = [];

  // Health components
  const { health: h, momentum, risk, developer } = health;

  // TVL contribution
  if (project.metrics.tvl !== undefined) {
    const tvlScore = Math.min((project.metrics.tvl / 1_000_000_000) * 100, 100);
    if (tvlScore > 50) reasons.push(`Strong TVL ($${(project.metrics.tvl / 1_000_000).toFixed(1)}M) contributes positively to health`);
    else if (tvlScore > 10) reasons.push(`Moderate TVL ($${(project.metrics.tvl / 1_000_000).toFixed(1)}M) provides some health support`);
    else reasons.push(`Low TVL ($${(project.metrics.tvl / 1_000_000).toFixed(1)}M) limits health score`);
  } else {
    reasons.push("No TVL data available — health score reflects this uncertainty");
  }

  // Volume contribution
  if (project.metrics.volume24h !== undefined && project.metrics.volume24h > 0) {
    const volScore = Math.min((project.metrics.volume24h / 200_000_000) * 100, 100);
    if (volScore > 30) reasons.push(`Healthy 24h volume ($${(project.metrics.volume24h / 1_000_000).toFixed(1)}M) signals activity`);
    else reasons.push(`Low 24h volume ($${(project.metrics.volume24h / 1_000_000).toFixed(1)}M) suggests limited trading activity`);
  }

  // Developer activity
  if (project.metrics.developerActivity !== undefined && project.metrics.developerActivity > 0) {
    const devScore = Math.min((project.metrics.developerActivity / 50) * 100, 100);
    if (devScore > 40) reasons.push(`Strong developer activity (${project.metrics.developerActivity} commits) supports long-term health`);
    else reasons.push(`Some developer activity (${project.metrics.developerActivity} commits) detected`);
  } else {
    reasons.push("No developer activity data — velocity contribution is zero");
  }

  // Evidence support
  if (evidence.length > 0) {
    const verifiedCount = evidence.filter(e => e.status === "verified").length;
    const demoCount = evidence.filter(e => e.status === "demo").length;
    if (verifiedCount > 0) reasons.push(`${verifiedCount} verified evidence item(s) back this assessment`);
    if (demoCount > 0) reasons.push(`${demoCount} demo evidence item(s) — treat with caution`);
  } else {
    reasons.push("No backing evidence — health score is purely metrics-derived");
  }

  // Risk factors
  if (risk > 60) reasons.push(`Elevated risk (${Math.round(risk)}/100) due to sparse/stale evidence or missing metrics`);
  else if (risk > 30) reasons.push(`Moderate risk (${Math.round(risk)}/100) — some evidence gaps or staleness`);
  else reasons.push(`Low risk (${Math.round(risk)}/100) — good evidence coverage and freshness`);

  // Momentum
  if (momentum > 25) reasons.push(`Positive momentum (+${Math.round(momentum)}%) — evidence and developer signals trending up`);
  else if (momentum < -25) reasons.push(`Negative momentum (${Math.round(momentum)}%) — declining evidence support or activity`);
  else reasons.push(`Flat momentum (${Math.round(momentum)}%) — stable but not accelerating`);

  return reasons;
}

/**
 * Explain a narrative derivation with supporting evidence and projects.
 */
export function explainNarrative(
  narrative: Narrative,
  projects: readonly Project[],
  evidence: readonly Evidence[],
): string[] {
  const reasons: string[] = [];

  reasons.push(`${narrative.name} narrative identified across ${projects.length} project(s)`);

  if (narrative.change) {
    reasons.push(`Momentum change: ${narrative.change} (trend: ${narrative.trend})`);
  }

  if (narrative.note) {
    reasons.push(narrative.note);
  }

  if (projects.length > 0) {
    const projectNames = projects.map(p => p.name).join(", ");
    reasons.push(`Representative projects: ${projectNames}`);
  }

  if (evidence.length > 0) {
    const verifiedCount = evidence.filter(e => e.status === "verified").length;
    const demoCount = evidence.filter(e => e.status === "demo").length;
    reasons.push(`Backed by ${evidence.length} evidence item(s): ${verifiedCount} verified, ${demoCount} demo`);
    
    // Show top evidence notes
    const topEvidence = evidence.slice(0, 3).map(e => e.note).join("; ");
    if (topEvidence) {
      reasons.push(`Key evidence: ${topEvidence}`);
    }
  }

  return reasons;
}

/**
 * Explain an intelligence signal with its supporting evidence and confidence.
 */
export function explainSignal(
  signal: { id: string; type: string; title: string; confidence: number; evidenceIds: string[]; supportingEvidence: { evidenceId: string; relationship: string; weight?: number }[] },
  evidenceById: Map<string, Evidence>,
): string[] {
  const reasons: string[] = [];

  reasons.push(`${signal.title} (type: ${signal.type}, confidence: ${Math.round(signal.confidence * 100)}%)`);

  if (signal.supportingEvidence.length > 0) {
    reasons.push(`Supported by ${signal.supportingEvidence.length} evidence item(s):`);
    for (const se of signal.supportingEvidence) {
      const item = evidenceById.get(se.evidenceId);
      if (item) {
        reasons.push(`  - ${se.relationship}: ${item.note} [${item.status}]`);
      }
    }
  }

  // Confidence breakdown
  if (signal.confidence >= 0.7) reasons.push("High confidence — multiple verified sources, strong correlation");
  else if (signal.confidence >= 0.4) reasons.push("Moderate confidence — some correlation, limited provider diversity");
  else reasons.push("Low confidence — weak correlation or sparse evidence");

  return reasons;
}

/**
 * Explain a report's sections (thesis, catalyst, risk) with traceable reasoning.
 */
export function explainReport(
  report: Report,
  projects: readonly ScoredProject[],
  narratives: readonly DerivedNarrative[],
  evidenceById: Map<string, Evidence>,
  lens: ReportLens,
): string[] {
  const reasons: string[] = [];

  reasons.push(`Report generated through "${lens}" lens`);
  reasons.push(`Title: ${report.title}`);

  // Thesis explanation
  if (report.sections.thesis) {
    reasons.push(`Thesis: ${report.sections.thesis}`);
    
    // Find the narrative driving the thesis
    const relevantNarrative = narratives.find(n => 
      n.narrative.name.toLowerCase().includes(lens) || 
      (lens === "ecosystem" && n.narrative.name === "Ecosystem") ||
      (lens === "defi" && n.narrative.name === "DeFi") ||
      (lens === "infrastructure" && n.narrative.name === "Infrastructure")
    );
    
    if (relevantNarrative) {
      reasons.push(`Driven by ${relevantNarrative.narrative.name} narrative (momentum: ${Math.round(relevantNarrative.momentum)}%)`);
    }
  }

  // Catalyst explanation
  if (report.sections.catalyst) {
    reasons.push(`Catalyst: ${report.sections.catalyst}`);
    
    // Find strongest project
    let strongest: ScoredProject | undefined;
    for (const sp of projects) {
      if (!strongest || sp.health.health > strongest.health.health) {
        strongest = sp;
      }
    }
    if (strongest) {
      reasons.push(`Strongest project in scope: ${strongest.project.name} (health: ${Math.round(strongest.health.health)}/100, risk: ${Math.round(strongest.health.risk)}/100)`);
    }
  }

  // Risk explanation
  if (report.sections.risk) {
    reasons.push(`Risk: ${report.sections.risk}`);
    reasons.push(`Overall report confidence: ${report.confidence}`);
  }

  // Evidence traceability
  if (report.evidenceIds.length > 0) {
    const evidence = report.evidenceIds.map(id => evidenceById.get(id)).filter((e): e is Evidence => e !== undefined);
    const verifiedCount = evidence.filter(e => e.status === "verified").length;
    const demoCount = evidence.filter(e => e.status === "demo").length;
    reasons.push(`Report backed by ${report.evidenceIds.length} evidence reference(s): ${verifiedCount} verified, ${demoCount} demo`);
  }

  if (report.isDemo) {
    reasons.push("⚠ This report is based on demo/synthetic data — not for production use");
  }

  return reasons;
}

/**
 * Format explanations as a structured object for API/UI consumption.
 */
export interface ExplanationResult {
  summary: string;
  details: string[];
  traceability: {
    evidenceIds: string[];
    projectIds?: string[];
    narrativeIds?: string[];
  };
}

export function formatProjectHealthExplanation(
  project: Project,
  health: ProjectHealth,
  evidence: readonly Evidence[],
): ExplanationResult {
  const details = explainProjectHealth(project, health, evidence);
  return {
    summary: `${project.name} health: ${Math.round(health.health)}/100 (momentum: ${Math.round(health.momentum)}%, risk: ${Math.round(health.risk)}/100, developer: ${Math.round(health.developer)}/100)`,
    details,
    traceability: {
      evidenceIds: evidence.map(e => e.id),
      projectIds: [project.id],
    },
  };
}

export function formatNarrativeExplanation(
  narrative: Narrative,
  projects: readonly Project[],
  evidence: readonly Evidence[],
): ExplanationResult {
  const details = explainNarrative(narrative, projects, evidence);
  return {
    summary: `${narrative.name} narrative (${narrative.trend}${narrative.change ? ` ${narrative.change}` : ""})`,
    details,
    traceability: {
      evidenceIds: evidence.map(e => e.id),
      projectIds: projects.map(p => p.id),
      narrativeIds: [narrative.id],
    },
  };
}

export function formatSignalExplanation(
  signal: { id: string; type: string; title: string; confidence: number; evidenceIds: string[]; supportingEvidence: { evidenceId: string; relationship: string; weight?: number }[] },
  evidenceById: Map<string, Evidence>,
): ExplanationResult {
  const details = explainSignal(signal, evidenceById);
  return {
    summary: `${signal.title} — ${Math.round(signal.confidence * 100)}% confidence`,
    details,
    traceability: {
      evidenceIds: signal.evidenceIds,
    },
  };
}

export function formatReportExplanation(
  report: Report,
  projects: readonly ScoredProject[],
  narratives: readonly DerivedNarrative[],
  evidenceById: Map<string, Evidence>,
  lens: ReportLens,
): ExplanationResult {
  const details = explainReport(report, projects, narratives, evidenceById, lens);
  return {
    summary: `${report.title} [${lens} lens, ${report.confidence} confidence]`,
    details,
    traceability: {
      evidenceIds: report.evidenceIds,
      projectIds: projects.map(p => p.project.id),
      narrativeIds: narratives.map(n => n.narrative.id),
    },
  };
}