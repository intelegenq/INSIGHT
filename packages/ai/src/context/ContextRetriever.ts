/**
 * Insight context retrieval — deterministic context builder over existing
 * Insight data contracts.
 *
 * Given a user question, retrieves relevant projects, evidence, narratives,
 * reports, and knowledge graph entities from Insight's existing data store.
 * No web search, no external retrieval — only Insight's collected data.
 */
import type { Project, Evidence, Narrative, Report } from "@insight/core";
import type { KnowledgeGraph } from "@insight/knowledge";

/** Structured context sent to the AI provider. */
export interface InsightContext {
  /** Projects relevant to the question. */
  projects: Project[];
  /** Evidence items relevant to the question. */
  evidence: Evidence[];
  /** Narratives relevant to the question. */
  narratives: Narrative[];
  /** Reports relevant to the question. */
  reports: Report[];
  /** Knowledge graph entity count (for bounded context). */
  graphEntityCount: number;
  /** Knowledge graph relationship count. */
  graphRelationshipCount: number;
  /** Graph entities (bounded subset). */
  graphEntities: Array<{ kind: string; id: string; name?: string }>;
  /** Whether Insight has sufficient data to answer. */
  hasSufficientData: boolean;
  /** Summary of what was retrieved. */
  summary: string;
}

/** Options for context retrieval. */
export interface ContextRetrievalOptions {
  /** Maximum projects to include. */
  maxProjects?: number;
  /** Maximum evidence items to include. */
  maxEvidence?: number;
  /** Maximum narratives to include. */
  maxNarratives?: number;
  /** Maximum reports to include. */
  maxReports?: number;
  /** Maximum graph entities to include. */
  maxGraphEntities?: number;
}

const DEFAULTS: Required<ContextRetrievalOptions> = {
  maxProjects: 10,
  maxEvidence: 20,
  maxNarratives: 5,
  maxReports: 3,
  maxGraphEntities: 15,
};

/** Data source interface — implemented by InsightService or test mocks. */
export interface InsightDataSource {
  listProjects(): Promise<Project[]>;
  resolveEvidenceIds(ids: readonly string[]): Promise<Evidence[]>;
  getNarratives(): Promise<Narrative[]>;
  getReport(lens?: string): Promise<Report | undefined>;
}

/** Graph data source — optional, for knowledge graph context. */
export interface GraphDataSource {
  /** Get the current knowledge graph. */
  getKnowledgeGraph(): Promise<KnowledgeGraph | undefined>;
}

/**
 * ContextRetriever — builds bounded structured context from Insight data.
 */
export class ContextRetriever {
  constructor(
    private readonly data: InsightDataSource,
    private readonly graph?: GraphDataSource,
  ) {}

  /**
   * Retrieve relevant Insight context for a user question.
   * Uses simple keyword matching to select relevant items.
   */
  async retrieve(question: string, options: ContextRetrievalOptions = {}): Promise<InsightContext> {
    const opts = { ...DEFAULTS, ...options };
    const q = question.toLowerCase();
    const keywords = q.split(/\s+/).filter((w) => w.length > 2);

    // Fetch all data from Insight's existing contracts
    const [allProjects, allNarratives, report] = await Promise.all([
      this.data.listProjects(),
      this.data.getNarratives(),
      this.data.getReport("ecosystem").catch(() => undefined),
    ]);

    // Score projects by keyword relevance
    const scoredProjects = allProjects
      .map((p) => ({
        project: p,
        score: this.scoreByKeywords(`${p.name} ${p.category} ${p.description} ${p.id}`, keywords),
      }))
      .sort((a, b) => b.score - a.score);

    const projects = scoredProjects.slice(0, opts.maxProjects).map((s) => s.project);

    // Collect evidence IDs from matched projects
    const evidenceIds = projects.flatMap((p) => p.evidenceIds);
    const evidence = await this.data
      .resolveEvidenceIds(evidenceIds)
      .then((items) => items.slice(0, opts.maxEvidence))
      .catch(() => []);

    // Score narratives by keyword relevance
    const scoredNarratives = allNarratives
      .map((n) => ({
        narrative: n,
        score: this.scoreByKeywords(`${n.name} ${n.note} ${n.id}`, keywords),
      }))
      .sort((a, b) => b.score - a.score);

    const narratives = scoredNarratives.slice(0, opts.maxNarratives).map((s) => s.narrative);

    // Include the ecosystem report if available
    const reports: Report[] = report ? [report].slice(0, opts.maxReports) : [];

    // Knowledge graph context (optional, bounded)
    let graphEntityCount = 0;
    let graphRelationshipCount = 0;
    let graphEntities: Array<{ kind: string; id: string; name?: string }> = [];

    if (this.graph) {
      const kg = await this.graph.getKnowledgeGraph().catch(() => undefined);
      if (kg) {
        graphRelationshipCount = kg.relationships.length;
        const entityIds = Array.from(kg.entities.keys());
        graphEntityCount = entityIds.length;
        graphEntities = entityIds.slice(0, opts.maxGraphEntities).map((id) => {
          const entity = kg.entities.get(id);
          if (!entity) return { kind: "unknown", id };
          return {
            kind: entity.kind,
            id,
            name: "name" in entity ? entity.name : undefined,
          };
        });
      }
    }

    const hasSufficientData = projects.length > 0 || evidence.length > 0 || narratives.length > 0;

    const summary = this.buildSummary(
      projects.length,
      evidence.length,
      narratives.length,
      reports.length,
      graphEntityCount,
      graphRelationshipCount,
      hasSufficientData,
    );

    return {
      projects,
      evidence,
      narratives,
      reports,
      graphEntityCount,
      graphRelationshipCount,
      graphEntities,
      hasSufficientData,
      summary,
    };
  }

  /** Score a text by counting keyword matches. */
  private scoreByKeywords(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 1; // No keywords = neutral relevance
    const lower = text.toLowerCase();
    return keywords.reduce((score, kw) => (lower.includes(kw) ? score + 1 : score), 0);
  }

  private buildSummary(
    projectCount: number,
    evidenceCount: number,
    narrativeCount: number,
    reportCount: number,
    graphEntities: number,
    graphRelationships: number,
    hasSufficientData: boolean,
  ): string {
    if (!hasSufficientData) {
      return "Insight has no sufficient data to answer this question. The data pipeline may not have been refreshed yet, or no projects match the query.";
    }
    return `Context: ${projectCount} projects, ${evidenceCount} evidence items, ${narrativeCount} narratives, ${reportCount} reports, ${graphEntities} graph entities, ${graphRelationships} graph relationships.`;
  }
}

/**
 * Serialize context to a bounded JSON string for the AI prompt.
 * Keeps token usage bounded by limiting array sizes.
 */
export function serializeContext(ctx: InsightContext): string {
  return JSON.stringify({
    projects: ctx.projects.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      chain: p.chain,
      metrics: p.metrics,
      evidenceIds: p.evidenceIds,
    })),
    evidence: ctx.evidence.map((e) => ({
      id: e.id,
      source: e.source,
      status: e.status,
      note: e.note,
      reference: e.reference,
      chain: e.chain,
    })),
    narratives: ctx.narratives.map((n) => ({
      id: n.id,
      name: n.name,
      trend: n.trend,
      change: n.change,
      note: n.note,
      projectIds: n.projectIds,
    })),
    reports: ctx.reports.map((r) => ({
      id: r.id,
      title: r.title,
      lens: r.lens,
      confidence: r.confidence,
      thesis: r.sections.thesis,
      catalyst: r.sections.catalyst,
      risk: r.sections.risk,
    })),
    graph: {
      entityCount: ctx.graphEntityCount,
      relationshipCount: ctx.graphRelationshipCount,
      entities: ctx.graphEntities,
    },
    summary: ctx.summary,
    hasSufficientData: ctx.hasSufficientData,
  });
}
