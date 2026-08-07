/**
 * @insight/knowledge — deterministic knowledge graph.
 *
 * Typed entity and relationship models, a pure graph builder, deterministic
 * traversal, and a resolver API. No React, no Next.js, no external APIs, no
 * I/O, no randomness. Depends only on @insight/core and @insight/data.
 */

export { STATUS_WEIGHT } from "@insight/core";

export type {
  AdjacencyIndex,
  Entity,
  EntityIndex,
  EntityKind,
  EvidenceEntity,
  KnowledgeGraph,
  NarrativeEntity,
  ProjectEntity,
  Relationship,
  RelationshipType,
  SourceEntity,
} from "./models";
export { compareRelationships } from "./models";

export { buildKnowledgeGraph } from "./builder";

export { findPath, neighbors, inbound, subgraph, traverse } from "./traversal";
export type { TraversalOptions } from "./traversal";

export {
  resolveEntities,
  resolveEntity,
  resolveNeighborhood,
  resolveRelationships,
  resolveSubgraph,
} from "./resolver";
export type { EntityQuery, RelationshipQuery, ResolvedEntity } from "./resolver";
