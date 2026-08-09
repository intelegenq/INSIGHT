/**
 * Assistant service — the core M31 orchestration layer.
 *
 * Flow: user question → Insight context retrieval → bounded prompt → AI provider → answer + citations.
 *
 * The AI is ONLY a natural-language interface over Insight's deterministic data.
 * It must NOT invent facts, browse the web, or create independent intelligence.
 */
import type {
  AIProvider,
  AIRequest,
  AssistantResponse,
  Citation,
  ProjectReference,
  NarrativeReference,
  ReportReference,
  GraphEntityReference,
  HealthReference,
  AssistantMetadata,
} from "../types";
import {
  ContextRetriever,
  serializeContext,
  type InsightDataSource,
  type GraphDataSource,
} from "../context/ContextRetriever";
import type { MockProvider } from "../providers/AIGateway";

/** System prompt with grounding instructions. */
const SYSTEM_PROMPT = `You are the Insight AI Assistant — a natural-language interface over Insight's deterministic data.

CRITICAL RULES:
1. Use ONLY the supplied Insight context to answer questions.
2. Do NOT invent facts, browse the web, or use external knowledge.
3. Distinguish evidence from inference: cite supplied evidence IDs when making claims.
4. If the Insight context is insufficient to answer, say so explicitly.
5. Do NOT make claims about data not present in the context.
6. Keep answers concise and grounded in the supplied structured data.
7. When citing evidence, reference the evidence ID (e.g. [evidence:ev-001]).

Your role is to translate Insight's structured data into clear natural-language answers, NOT to generate independent analysis.`;

/** Options for the assistant service. */
export interface AssistantServiceOptions {
  /** Override the AI provider (tests). */
  provider?: AIProvider;
  /** Override the data source (tests). */
  dataSource?: InsightDataSource;
  /** Override the graph data source (tests). */
  graphDataSource?: GraphDataSource;
}

/**
 * AssistantService — accepts a user question, retrieves Insight context,
 * calls the AI provider, and returns a structured response with citations.
 */
export class AssistantService {
  private readonly provider: AIProvider;
  private readonly retriever: ContextRetriever;

  constructor(
    provider: AIProvider,
    dataSource: InsightDataSource,
    graphDataSource?: GraphDataSource,
  ) {
    this.provider = provider;
    this.retriever = new ContextRetriever(dataSource, graphDataSource);
  }

  /**
   * Answer a user question using Insight data.
   * Returns a structured response with answer, citations, and metadata.
   */
  async answer(question: string): Promise<AssistantResponse> {
    if (!question || question.trim().length === 0) {
      return this.insufficientDataResponse("Please provide a question to answer.");
    }

    // 1. Retrieve relevant Insight context
    const context = await this.retriever.retrieve(question);

    // 2. If insufficient data, return a deterministic fallback
    if (!context.hasSufficientData) {
      return this.insufficientDataResponse(
        "Insight does not have sufficient data to answer this question. The data pipeline may not have been refreshed yet, or no projects match your query. Try asking about a specific project, narrative, or the ecosystem overview.",
        context,
      );
    }

    // 3. Build bounded prompt and call AI provider
    const contextJson = serializeContext(context);
    const request: AIRequest = {
      systemPrompt: SYSTEM_PROMPT,
      userMessage: question,
      context: contextJson,
      maxTokens: 2048,
      temperature: 0.3,
    };

    let providerUsed = false;
    let providerName = "none";
    let answer: string;

    try {
      const aiResponse = await this.provider.complete(request);
      providerUsed = true;
      providerName = aiResponse.provider;
      answer = aiResponse.text;
    } catch {
      // Provider failure — return a deterministic fallback from context
      answer = this.buildFallbackAnswer(context, question);
      providerName = "fallback";
    }

    // 4. Build citations from context evidence
    const citations: Citation[] = context.evidence.map((e) => ({
      evidenceId: e.id,
      source: typeof e.source === "string" ? e.source : (e.source.id ?? String(e.source)),
      status: e.status,
      note: e.note,
      reference: e.reference,
    }));

    // 5. Build project/narrative/report references
    const projects: ProjectReference[] = context.projects.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      chain: p.chain,
    }));

    const narratives: NarrativeReference[] = context.narratives.map((n) => ({
      id: n.id,
      name: n.name,
      trend: n.trend,
      change: n.change,
      note: n.note,
    }));

    const reports: ReportReference[] = context.reports.map((r) => ({
      id: r.id,
      title: r.title,
      lens: r.lens,
      confidence: r.confidence,
    }));

    const graphEntities: GraphEntityReference[] = context.graphEntities;
    const healthScores: HealthReference[] = context.healthScores;
    const pulse = context.pulse;
    const snapshotCount = context.snapshots.length;

    const metadata: AssistantMetadata = {
      providerUsed,
      providerName,
      contextSize: context.projects.length + context.evidence.length + context.narratives.length,
      hasSufficientData: context.hasSufficientData,
      timestamp: new Date().toISOString(),
    };

    return {
      answer,
      citations,
      projects,
      narratives,
      reports,
      graphEntities,
      healthScores,
      pulse,
      snapshotCount,
      metadata,
    };
  }

  /** Build a deterministic fallback answer when AI provider fails. */
  private buildFallbackAnswer(
    context: import("../context/ContextRetriever").InsightContext,
    question: string,
  ): string {
    const parts: string[] = [];
    parts.push(`Regarding: "${question}"\n`);
    parts.push(context.summary);
    parts.push("");

    if (context.projects.length > 0) {
      parts.push("Relevant projects:");
      for (const p of context.projects.slice(0, 5)) {
        parts.push(`- ${p.name} (${p.category}): ${p.description}`);
      }
    }

    if (context.narratives.length > 0) {
      parts.push("\nActive narratives:");
      for (const n of context.narratives.slice(0, 3)) {
        parts.push(`- ${n.name} (${n.trend}): ${n.note}`);
      }
    }

    parts.push(
      "\nNote: The AI provider was unavailable. This response is generated deterministically from Insight's structured data.",
    );
    return parts.join("\n");
  }

  /** Return an insufficient-data response. */
  private insufficientDataResponse(
    message: string,
    context?: import("../context/ContextRetriever").InsightContext,
  ): AssistantResponse {
    return {
      answer: message,
      citations: [],
      projects: [],
      narratives: [],
      reports: [],
      graphEntities: [],
      healthScores: [],
      pulse: null,
      snapshotCount: 0,
      metadata: {
        providerUsed: false,
        providerName: "none",
        contextSize: context ? context.projects.length + context.evidence.length : 0,
        hasSufficientData: false,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
