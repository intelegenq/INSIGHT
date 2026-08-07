import type { KnowledgeGraph, Relationship } from "./models";

/**
 * GraphTraversal — deterministic graph navigation.
 *
 * Traversal is order-stable: because the builder normalizes edge order,
 * iteration order in these functions is deterministic for identical inputs.
 * No I/O, no randomness.
 */

/** Options controlling traversal behavior. */
export interface TraversalOptions {
  /** Restrict traversal to these relationship types. */
  relationshipTypes?: readonly Relationship["type"][];
  /** Restrict traversal to these target entity kinds. */
  targetKinds?: readonly string[];
  /** Maximum hops from the origin (inclusive). Defaults to 1. */
  maxDepth?: number;
}

/**
 * Return the outbound neighbors of a node, optionally filtered.
 * Result is sorted by edge (from, to, type) then weight, matching the
 * canonical graph ordering.
 */
export function neighbors(
  graph: KnowledgeGraph,
  entityId: string,
  options: TraversalOptions = {},
): Relationship[] {
  const edges = graph.adjacency.get(entityId) ?? [];
  return filterEdges(edges, options);
}

/** Inbound edges pointing at a node (reverse lookups). */
export function inbound(
  graph: KnowledgeGraph,
  entityId: string,
  options: TraversalOptions = {},
): Relationship[] {
  const result: Relationship[] = [];
  for (const edges of graph.adjacency.values()) {
    for (const edge of edges) {
      if (edge.to === entityId && matches(edge, options)) {
        result.push(edge);
      }
    }
  }
  return result;
}

/**
 * Breadth-first traversal from an origin node up to `maxDepth` hops.
 * Returns visited node ids in deterministic BFS order (stable by edge order,
 * ties broken by id lexicographically at each frontier).
 */
export function traverse(
  graph: KnowledgeGraph,
  originId: string,
  options: TraversalOptions = {},
): string[] {
  const maxDepth = options.maxDepth ?? 1;
  const visited = new Set<string>([originId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: originId, depth: 0 }];
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    order.push(current.id);
    if (current.depth >= maxDepth) {
      continue;
    }

    const next = neighbors(graph, current.id, options)
      .map((edge) => edge.to)
      .filter((id) => allowedKind(graph, id, options))
      .filter((id) => !visited.has(id))
      .sort();

    for (const id of next) {
      visited.add(id);
      queue.push({ id, depth: current.depth + 1 });
    }
  }

  return order;
}

/**
 * Find a deterministic path between two nodes using BFS.
 * Returns the sequence of node ids (including both endpoints), or undefined
 * when no path exists. The first path found in canonical order is returned.
 */
export function findPath(
  graph: KnowledgeGraph,
  fromId: string,
  toId: string,
  options: TraversalOptions = {},
): string[] | undefined {
  if (fromId === toId) {
    return [fromId];
  }

  const queue: string[] = [fromId];
  const visited = new Set<string>([fromId]);
  const predecessor = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }

    const next = neighbors(graph, current, options)
      .map((edge) => edge.to)
      .filter((id) => allowedKind(graph, id, options))
      .filter((id) => !visited.has(id))
      .sort();

    for (const id of next) {
      visited.add(id);
      predecessor.set(id, current);
      if (id === toId) {
        return reconstructPath(fromId, toId, predecessor);
      }
      queue.push(id);
    }
  }

  return undefined;
}

/** Extract the subgraph reachable from an origin within maxDepth hops. */
export function subgraph(
  graph: KnowledgeGraph,
  originId: string,
  options: TraversalOptions = {},
): KnowledgeGraph {
  const ids = new Set(traverse(graph, originId, options));
  const entities = new Map([...graph.entities.entries()].filter(([id]) => ids.has(id)));
  const relationships = graph.relationships.filter(
    (edge) => ids.has(edge.from) && ids.has(edge.to),
  );

  const adjacency = new Map<string, Relationship[]>();
  for (const edge of relationships) {
    const bucket = adjacency.get(edge.from) ?? [];
    bucket.push(edge);
    adjacency.set(edge.from, bucket);
  }

  return { entities, adjacency, relationships };
}

function filterEdges(edges: readonly Relationship[], options: TraversalOptions): Relationship[] {
  return edges.filter((edge) => matches(edge, options));
}

function matches(edge: Relationship, options: TraversalOptions): boolean {
  if (options.relationshipTypes !== undefined && !options.relationshipTypes.includes(edge.type)) {
    return false;
  }
  return true;
}

/** Whether the node's entity kind passes the traversal filter. */
function allowedKind(graph: KnowledgeGraph, id: string, options: TraversalOptions): boolean {
  if (options.targetKinds === undefined || options.targetKinds.length === 0) {
    return true;
  }
  const entity = graph.entities.get(id);
  return entity !== undefined && options.targetKinds.includes(entity.kind);
}

function reconstructPath(
  fromId: string,
  toId: string,
  predecessor: ReadonlyMap<string, string>,
): string[] {
  const path: string[] = [];
  let cursor: string | undefined = toId;
  while (cursor !== undefined) {
    path.push(cursor);
    if (cursor === fromId) {
      break;
    }
    cursor = predecessor.get(cursor);
  }
  return path.reverse();
}
