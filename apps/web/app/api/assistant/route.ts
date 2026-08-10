import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../lib/api";
import { createAIProvider, AssistantService } from "@insight/ai";
import type { ExtendedInsightDataSource, GraphDataSource } from "@insight/ai";

/**
 * POST /api/assistant — ask the AI assistant a question about Insight data.
 *
 * Request: { "message": "..." }
 * Response: { answer, citations, projects, narratives, reports, graphEntities, healthScores, pulse, snapshotCount, metadata }
 *
 * The AI is ONLY a natural-language interface over Insight's deterministic data.
 * Server-side provider calls only — no API keys reach the browser.
 *
 * The data source wires ALL existing Insight contracts: projects, evidence,
 * narratives, reports, knowledge graph, health scores, pulse, and snapshots.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const body = (await request.json()) as { message?: unknown; pageContext?: unknown };
    const message = body?.message;
    const pageContext = typeof body?.pageContext === "string" ? body.pageContext : undefined;

    if (typeof message !== "string" || message.trim().length === 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Request body must contain a non-empty 'message' string.",
        400,
        undefined,
        requestId,
      );
    }

    // Use InsightService as the data source (existing contracts)
    const service = getInsightService();
    await service.ready();

    // Create AI provider from environment config
    const provider = createAIProvider();

    // Build an extended data source adapter over InsightService
    // Wires ALL existing Insight contracts so the AI context is comprehensive
    const dataSource: ExtendedInsightDataSource = {
      listProjects: () => service.listProjects(),
      resolveEvidenceIds: (ids) => service.resolveEvidenceIds(ids),
      getNarratives: () => service.getNarratives(),
      getReport: (lens) => service.getReport(lens as never),
      getProjectHealth: (projectId) => service.getProjectHealth(projectId),
      getPulse: async () => {
        const pulse = await service.getPulse();
        const findMetric = (id: string) => pulse.metrics.find((m) => m.id === id)?.value ?? "0";
        return {
          totalProjects: parseInt(findMetric("projects"), 10) || 0,
          totalNarratives: parseInt(findMetric("narratives"), 10) || 0,
          totalEvidence: parseInt(findMetric("evidence"), 10) || 0,
          generatedAt: pulse.asOf,
        };
      },
      listSnapshots: async () => {
        const snaps = await service.listSnapshots();
        return snaps.map((s) => ({
          id: s.id,
          referenceDate: s.referenceDate,
          projectCount: s.projects.length,
          narrativeCount: s.narratives.length,
          evidenceCount: s.evidence.length,
        }));
      },
    };

    // Wire the knowledge graph data source so the AI assistant
    // has access to graph entities and relationships as bounded context.
    const graphDataSource: GraphDataSource = {
      getKnowledgeGraph: () => service.getKnowledgeGraph(),
    };

    // Create and call the assistant service
    const assistant = new AssistantService(provider, dataSource, graphDataSource);
    // If page context is provided, prepend it to the question so the AI
    // receives structured context about the current page the user is viewing.
    const effectiveQuestion = pageContext
      ? `[Page Context] ${pageContext}\n\n[User Question] ${message}`
      : message;
    const response = await assistant.answer(effectiveQuestion);

    return ok(response);
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
