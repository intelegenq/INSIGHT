import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../lib/api";
import { createAIProvider } from "@insight/ai";
import { AssistantService } from "@insight/ai";
import type { InsightDataSource, GraphDataSource } from "@insight/ai";

/**
 * POST /api/assistant — ask the AI assistant a question about Insight data.
 *
 * Request: { "message": "..." }
 * Response: { answer, citations, projects, narratives, reports, metadata }
 *
 * The AI is ONLY a natural-language interface over Insight's deterministic data.
 * Server-side provider calls only — no API keys reach the browser.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const body = (await request.json()) as { message?: unknown };
    const message = body?.message;

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

    // Build a data source adapter over InsightService
    const dataSource: InsightDataSource = {
      listProjects: () => service.listProjects(),
      resolveEvidenceIds: (ids) => service.resolveEvidenceIds(ids),
      getNarratives: () => service.getNarratives(),
      getReport: (lens) => service.getReport(lens as never),
    };

    // M34: Wire the knowledge graph data source so the AI assistant
    // has access to graph entities and relationships as bounded context.
    const graphDataSource: GraphDataSource = {
      getKnowledgeGraph: () => service.getKnowledgeGraph(),
    };

    // Create and call the assistant service
    const assistant = new AssistantService(provider, dataSource, graphDataSource);
    const response = await assistant.answer(message);

    return ok(response);
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}
