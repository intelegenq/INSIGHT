import { getInsightService } from "../../../../lib/insight-service";
import { errorFromUnknown, errorResponse, ok, requestIdFromRequest } from "../../../../lib/api";
import { resolveEntity } from "@insight/knowledge";
import type { Entity, Relationship } from "@insight/knowledge";

/**
 * GET /api/graph/[id] — resolve a single entity and its neighborhood.
 *
 * Returns the entity, its outbound and inbound relationships, and
 * the connected entities resolved from the knowledge graph.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFromRequest(request);
  try {
    const { id } = await params;
    const service = getInsightService();
    const graph = await service.getKnowledgeGraph();

    const resolved = resolveEntity(graph, id);
    if (resolved === undefined) {
      return errorResponse(
        "NOT_FOUND",
        `Graph entity "${id}" not found.`,
        404,
        undefined,
        requestId,
      );
    }

    // Resolve connected entities from outbound + inbound edges
    const connectedIds = new Set<string>();
    for (const rel of resolved.outbound) {
      connectedIds.add(rel.to);
    }
    for (const rel of resolved.inbound) {
      connectedIds.add(rel.from);
    }

    const connections: Entity[] = [];
    for (const connectedId of connectedIds) {
      const entity = graph.entities.get(connectedId);
      if (entity !== undefined) {
        connections.push(entity);
      }
    }
    connections.sort((a, b) => a.id.localeCompare(b.id));

    return ok({
      entity: serializeEntity(resolved.entity),
      outbound: resolved.outbound.map(serializeRelationship),
      inbound: resolved.inbound.map(serializeRelationship),
      connections: connections.map(serializeEntity),
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
