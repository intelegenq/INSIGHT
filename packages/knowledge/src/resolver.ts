import type { KnowledgeGraph, Relationship } from "./models";
import type { Entity, EntityKind } from "./models";
import { inbound, neighbors, traverse } from "./traversal";
import type { TraversalOptions } from "./traversal";

/**
 * GraphResolver — deterministic read API over a {@link KnowledgeGraph}.
 *
 * All lookups are pure and order-stable: identical graph + query always
 * return identical results. No I/O, no randomness.
 */

/** Result of resolving a node: the entity plus its typed connections. */
export interface ResolvedEntity {
  entity: Entity;
  /** Outbound edges (from this node). */
  outbound: Relationship[];
  /** Inbound edges (pointing at this node). */
  inbound: Relationship[];
}

/** Criteria for querying entities. */
export interface EntityQuery {
  kind?: EntityKind;
  ids?: readonly string[];
}

/** Criteria for querying relationships. */
export interface RelationshipQuery {
  type?: Relationship["type"];
  fromId?: string;
  toId?: string;
}

/** Resolve a single entity plus its typed neighborhood. */
export function resolveEntity(
  graph: KnowledgeGraph,
  entityId: string,
  options: TraversalOptions = {},
): ResolvedEntity | undefined {
  const entity = graph.entities.get(entityId);
  if (entity === undefined) {
    return undefined;
  }
  return {
    entity,
    outbound: neighbors(graph, entityId, options),
    inbound: inbound(graph, entityId, options),
  };
}

/** Resolve many entities, returning only found ones in deterministic order. */
export function resolveEntities(graph: KnowledgeGraph, query: EntityQuery): Entity[] {
  const matches: Entity[] = [];
  for (const entity of graph.entities.values()) {
    if (query.kind !== undefined && entity.kind !== query.kind) {
      continue;
    }
    if (query.ids !== undefined && !query.ids.includes(entity.id)) {
      continue;
    }
    matches.push(entity);
  }
  const byKindOrder = kindRank();
  matches.sort((a, b) => {
    const kindDiff = byKindOrder[a.kind] - byKindOrder[b.kind];
    if (kindDiff !== 0) {
      return kindDiff;
    }
    return a.id.localeCompare(b.id);
  });
  return matches;
}

function kindRank(): Record<EntityKind, number> {
  const order: EntityKind[] = ["project", "evidence", "source", "narrative"];
  return {
    project: order.indexOf("project"),
    evidence: order.indexOf("evidence"),
    source: order.indexOf("source"),
    narrative: order.indexOf("narrative"),
  };
}

/** Resolve relationships matching a query, in canonical sorted order. */
export function resolveRelationships(
  graph: KnowledgeGraph,
  query: RelationshipQuery = {},
): Relationship[] {
  const result = graph.relationships.filter((edge) => {
    if (query.type !== undefined && edge.type !== query.type) {
      return false;
    }
    if (query.fromId !== undefined && edge.from !== query.fromId) {
      return false;
    }
    if (query.toId !== undefined && edge.to !== query.toId) {
      return false;
    }
    return true;
  });
  return result;
}

/** Resolve the subgraph induced by a set of node ids. */
export function resolveSubgraph(graph: KnowledgeGraph, ids: readonly string[]): KnowledgeGraph {
  const set = new Set(ids);
  const entities = new Map([...graph.entities.entries()].filter(([id]) => set.has(id)));
  const relationships = graph.relationships.filter(
    (edge) => set.has(edge.from) && set.has(edge.to),
  );

  const adjacency = new Map<string, Relationship[]>();
  for (const edge of relationships) {
    const bucket = adjacency.get(edge.from) ?? [];
    bucket.push(edge);
    adjacency.set(edge.from, bucket);
  }

  return { entities, adjacency, relationships };
}

/** Resolve the reachable neighborhood of an origin within maxDepth hops. */
export function resolveNeighborhood(
  graph: KnowledgeGraph,
  originId: string,
  options: TraversalOptions = {},
): Entity[] {
  const ids = traverse(graph, originId, options);
  return resolveEntities(graph, { ids });
}
