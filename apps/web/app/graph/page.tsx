"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface GraphEntity {
  kind: "project" | "evidence" | "source" | "narrative";
  id: string;
  name?: string;
  category?: string;
  sourceId?: string;
  note?: string;
  status?: string;
  trend?: string;
}

interface GraphRelationship {
  type: "backs" | "sources" | "features" | "supports";
  from: string;
  to: string;
  weight: number;
}

interface GraphSummary {
  entityCount: number;
  relationshipCount: number;
  kindCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

interface GraphResponse {
  summary: GraphSummary;
  entities: GraphEntity[];
  relationships: GraphRelationship[];
}

interface EntityDetail {
  entity: GraphEntity;
  outbound: GraphRelationship[];
  inbound: GraphRelationship[];
  connections: GraphEntity[];
}

type KindFilter = "all" | "project" | "evidence" | "source" | "narrative";

const kindLabels: Record<string, string> = {
  project: "Projects",
  evidence: "Evidence",
  source: "Sources",
  narrative: "Narratives",
};

const relLabels: Record<string, string> = {
  backs: "backs",
  sources: "sourced from",
  features: "features",
  supports: "supported by",
};

const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "";

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadGraph() {
      try {
        const res = await fetch(`${baseUrl}/api/graph`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GraphResponse;
        if (!cancelled) {
          setGraph(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    }
    loadGraph();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectEntity = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    try {
      const res = await fetch(`${baseUrl}/api/graph/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as EntityDetail;
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entity");
    }
  }, []);

  const filteredEntities = graph
    ? filter === "all"
      ? graph.entities
      : graph.entities.filter((e) => e.kind === filter)
    : [];

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <div className="nav-links">
          <Link href="/#pulse">Pulse</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/narratives">Narratives</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/graph" className="nav-active">
            Graph
          </Link>
          <Link href="/history">History</Link>
        </div>
      </nav>

      <section className="graph-hero">
        <p className="eyebrow">KNOWLEDGE GRAPH</p>
        <h1>
          Trace the connections.
          <br />
          <em>Every link is evidence.</em>
        </h1>
        <p className="hero-copy">
          The knowledge graph connects projects, evidence, sources, and narratives into a
          inspectable network. Every edge is deterministic — derived from Insight&apos;s collected
          data, not invented.
        </p>
      </section>

      {loading && (
        <section className="section">
          <p className="muted">Loading knowledge graph...</p>
        </section>
      )}

      {error && (
        <section className="section">
          <div className="assistant-error">
            <strong>Error:</strong> {error}
          </div>
        </section>
      )}

      {graph && (
        <>
          <section className="section" aria-labelledby="graph-summary-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">GRAPH SUMMARY</p>
                <h2 id="graph-summary-title">Graph at a glance</h2>
              </div>
            </div>
            <div className="metric-grid">
              <article className="metric-card" key="entities">
                <span>Entities</span>
                <strong>{graph.summary.entityCount}</strong>
                <small>Total nodes in the graph</small>
              </article>
              <article className="metric-card violet" key="relationships">
                <span>Relationships</span>
                <strong>{graph.summary.relationshipCount}</strong>
                <small>Directed edges</small>
              </article>
              <article className="metric-card" key="kinds">
                <span>Entity Kinds</span>
                <strong>{Object.keys(graph.summary.kindCounts).length}</strong>
                <small>
                  {Object.entries(graph.summary.kindCounts)
                    .map(([k, v]) => `${kindLabels[k] ?? k}: ${v}`)
                    .join(" · ")}
                </small>
              </article>
            </div>
            <div className="rel-type-breakdown">
              {Object.entries(graph.summary.typeCounts).map(([type, count]) => (
                <span key={type} className="rel-type-chip">
                  {relLabels[type] ?? type}: {count}
                </span>
              ))}
            </div>
          </section>

          <section className="section graph-browser" aria-labelledby="graph-browser-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ENTITY BROWSER</p>
                <h2 id="graph-browser-title">Explore nodes</h2>
              </div>
              <div className="kind-filters">
                {(["all", "project", "evidence", "source", "narrative"] as KindFilter[]).map(
                  (k) => (
                    <button
                      key={k}
                      className={filter === k ? "lens active" : "lens"}
                      onClick={() => setFilter(k)}
                    >
                      {k === "all" ? "All" : (kindLabels[k] ?? k)}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="graph-layout">
              <div className="entity-list">
                {filteredEntities.length === 0 && (
                  <p className="muted">No entities of this kind.</p>
                )}
                {filteredEntities.map((entity) => (
                  <button
                    key={entity.id}
                    className={selectedId === entity.id ? "entity-card selected" : "entity-card"}
                    onClick={() => void selectEntity(entity.id)}
                  >
                    <span className={`entity-kind-badge ${entity.kind}`}>{entity.kind}</span>
                    <div className="entity-card-body">
                      <strong>{entity.name ?? entity.id}</strong>
                      {entity.category && <span className="entity-meta">{entity.category}</span>}
                      {entity.status && <span className="entity-meta">{entity.status}</span>}
                      {entity.trend && <span className="entity-meta">{entity.trend}</span>}
                      {entity.note && <span className="entity-note">{entity.note}</span>}
                      <span className="entity-id">{entity.id}</span>
                    </div>
                  </button>
                ))}
              </div>

              <aside className="entity-detail">
                {!selectedId && (
                  <p className="muted">Select an entity to inspect its connections.</p>
                )}
                {selectedId && !detail && <p className="muted">Loading...</p>}
                {detail && (
                  <div>
                    <div className="detail-header">
                      <span className={`entity-kind-badge ${detail.entity.kind}`}>
                        {detail.entity.kind}
                      </span>
                      <h3>{detail.entity.name ?? detail.entity.id}</h3>
                    </div>
                    <p className="entity-id">{detail.entity.id}</p>

                    {detail.entity.category && (
                      <p className="detail-meta">
                        <strong>Category:</strong> {detail.entity.category}
                      </p>
                    )}
                    {detail.entity.status && (
                      <p className="detail-meta">
                        <strong>Status:</strong> {detail.entity.status}
                      </p>
                    )}
                    {detail.entity.trend && (
                      <p className="detail-meta">
                        <strong>Trend:</strong> {detail.entity.trend}
                      </p>
                    )}
                    {detail.entity.note && (
                      <p className="detail-meta">
                        <strong>Note:</strong> {detail.entity.note}
                      </p>
                    )}

                    {detail.outbound.length > 0 && (
                      <div className="detail-section">
                        <h4>Outbound ({detail.outbound.length})</h4>
                        <ul className="edge-list">
                          {detail.outbound.map((edge, i) => (
                            <li key={i}>
                              <button
                                className="edge-link"
                                onClick={() => void selectEntity(edge.to)}
                              >
                                <span className="edge-type">
                                  {relLabels[edge.type] ?? edge.type}
                                </span>
                                <span className="edge-target">{edge.to}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {detail.inbound.length > 0 && (
                      <div className="detail-section">
                        <h4>Inbound ({detail.inbound.length})</h4>
                        <ul className="edge-list">
                          {detail.inbound.map((edge, i) => (
                            <li key={i}>
                              <button
                                className="edge-link"
                                onClick={() => void selectEntity(edge.from)}
                              >
                                <span className="edge-type">
                                  {relLabels[edge.type] ?? edge.type}
                                </span>
                                <span className="edge-target">{edge.from}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {detail.connections.length > 0 && (
                      <div className="detail-section">
                        <h4>Connected Entities ({detail.connections.length})</h4>
                        <ul className="connection-list">
                          {detail.connections.map((conn) => (
                            <li key={conn.id}>
                              <button
                                className="edge-link"
                                onClick={() => void selectEntity(conn.id)}
                              >
                                <span className={`entity-kind-badge ${conn.kind}`}>
                                  {conn.kind}
                                </span>
                                <span>{conn.name ?? conn.id}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {detail.entity.kind === "project" && (
                      <Link
                        href={`/projects/${detail.entity.id}`}
                        className="inline-button primary-button"
                      >
                        View project page →
                      </Link>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </section>
        </>
      )}

      <footer>
        <Link className="brand" href="/">
          <span>◎</span> insight
        </Link>
        <p>Built for better questions about Solana.</p>
        <p>© 2026 Insight</p>
      </footer>
    </main>
  );
}
