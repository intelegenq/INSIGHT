import { getInsightService } from "../../../lib/insight-service";
import { errorFromUnknown, ok, requestIdFromRequest } from "../../../lib/api";
import {
  resolveEntities,
  resolveRelationships,
  type Entity,
  type KnowledgeGraph,
  type Relationship,
} from "@insight/knowledge";

/**
 * GET /api/graph — knowledge graph overview.
 *
 * Returns entity and relationship summaries, plus an optional
 * entity list filtered by ?kind=project|evidence|source|narrative.
 *
 * The knowledge graph is built deterministically by the runtime from
 * projects, evidence, and narratives — no external data, no randomness.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const url = new URL(request.url);
    const kindFilter = url.searchParams.get("kind");

    const service = getInsightService();
    const graph = await service.getKnowledgeGraph();

    const entities: Entity[] = resolveEntities(graph, {
      kind: kindFilter === null ? undefined : (kindFilter as Entity["kind"]),
    });

    const relationships: Relationship[] = resolveRelationships(graph);

    const entityCount = graph.entities.size;
    const relationshipCount = graph.relationships.length;

    // Summary by kind
    const kindCounts: Record<string, number> = {};
    for (const entity of graph.entities.values()) {
      kindCounts[entity.kind] = (kindCounts[entity.kind] ?? 0) + 1;
    }

    // Summary by relationship type
    const typeCounts: Record<string, number> = {};
    for (const rel of graph.relationships) {
      typeCounts[rel.type] = (typeCounts[rel.type] ?? 0) + 1;
    }

    return ok({
      summary: {
        entityCount,
        relationshipCount,
        kindCounts,
        typeCounts,
      },
      entities: entities.map(serializeEntity),
      relationships: relationships.map(serializeRelationship),
    });
  } catch (error) {
    return errorFromUnknown(error, requestId);
  }
}

function serializeEntity(entity: Entity) {
  switch (entity.kind) {
    case "project":
      return { kind: entity.kind, id: entity.id, name: entity.name, category: entity.category };
    case "evidence":
      return {
        kind: entity.kind,
        id: entity.id,
        sourceId: entity.sourceId,
        note: entity.note,
        status: entity.status,
      };
    case "source":
      return { kind: entity.kind, id: entity.id, name: entity.name };
    case "narrative":
      return { kind: entity.kind, id: entity.id, name: entity.name, trend: entity.trend };
  }
}

function serializeRelationship(rel: Relationship) {
  return { type: rel.type, from: rel.from, to: rel.to, weight: rel.weight };
}
