/**
 * Knowledge graph entity and relationship models.
 *
 * The graph is a typed, directed multigraph. Entities are the nodes
 * (projects, evidence, sources, narratives); relationships are the edges.
 * Everything here is pure data — no I/O, no randomness, no external
 * dependencies beyond @insight/core.
 */

/** Discriminated kinds of nodes in the knowledge graph. */
export type EntityKind = "project" | "evidence" | "source" | "narrative";

/** A node in the knowledge graph, discriminated by kind. */
export interface ProjectEntity {
  kind: "project";
  id: string;
  name: string;
  category: string;
}

export interface EvidenceEntity {
  kind: "evidence";
  id: string;
  sourceId: string;
  note: string;
  status: string;
}

export interface SourceEntity {
  kind: "source";
  id: string;
  name: string;
}

export interface NarrativeEntity {
  kind: "narrative";
  id: string;
  name: string;
  trend: string;
}

export type Entity = ProjectEntity | EvidenceEntity | SourceEntity | NarrativeEntity;

/** Directed relationship types between entities. */
export type RelationshipType =
  /** project -[backs]-> evidence : project's evidenceIds reference evidence */
  | "backs"
  /** evidence -[sources]-> source : evidence comes from a source */
  | "sources"
  /** narrative -[features]-> project : narrative represents a project */
  | "features"
  /** narrative -[supports]-> evidence : narrative backed by evidence */
  | "supports";

/** A directed edge in the graph. */
export interface Relationship {
  /** Machine-readable type. */
  type: RelationshipType;
  /** Source node id. */
  from: string;
  /** Target node id. */
  to: string;
  /** Deterministic weight derived from trust/freshness, used for ranking. */
  weight: number;
}

/** Immutable adjacency index: node id -> ordered outgoing edges. */
export type AdjacencyIndex = ReadonlyMap<string, readonly Relationship[]>;

/** Immutable node index: id -> entity. */
export type EntityIndex = ReadonlyMap<string, Entity>;

/** A complete knowledge graph. */
export interface KnowledgeGraph {
  entities: EntityIndex;
  adjacency: AdjacencyIndex;
  /** All edges in deterministic (sorted) order. */
  relationships: readonly Relationship[];
}

/** Stable ordering used to make graph output deterministic. */
export function compareRelationships(a: Relationship, b: Relationship): number {
  if (a.from !== b.from) {
    return a.from.localeCompare(b.from);
  }
  if (a.to !== b.to) {
    return a.to.localeCompare(b.to);
  }
  if (a.type !== b.type) {
    return a.type.localeCompare(b.type);
  }
  return a.weight - b.weight;
}
