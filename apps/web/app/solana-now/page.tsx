"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ProjectLogo } from "../../components/ProjectLogo";
import { useCopilot } from "../../components/Copilot";

interface TimelineEntry {
  id: string;
  title: string;
  source: string;
  confidence: string;
}
interface AnomalyItem {
  id: string;
  type: string;
  description: string;
  severity: number;
  targetName?: string;
}
interface Project {
  id: string;
  name: string;
  category: string;
  metrics: { tvl?: number; volume24h?: number };
  logoUrl?: string;
  change24h?: number;
  classification?: string;
}
interface HealthProvider {
  id: string;
  status: string;
}

function fmtUsd(v: number | undefined): string {
  if (!v) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

export default function SolanaNowPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Solana Now] Real-time intelligence feed with breaking events, data alerts, network status, and ecosystem updates.",
    );
  }, [setPageContext]);

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [tlRes, anRes, pRes, hRes] = await Promise.all([
        fetch("/api/pulse")
          .then((r) => r.json())
          .catch(() => ({ timeline: [] })),
        fetch("/api/anomalies")
          .then((r) => r.json())
          .catch(() => ({ anomalies: [] })),
        fetch("/api/projects?classification=solana_ecosystem")
          .then((r) => r.json())
          .catch(() => ({ projects: [] })),
        fetch("/api/health")
          .then((r) => r.json())
          .catch(() => ({ providers: [] })),
      ]);
      setTimeline((tlRes.timeline ?? []).filter((t: TimelineEntry) => {
        const cexNames = ["binance","bybit","okx","bitfinex","gate","mexc","bitget","deribit","htx","coinbase","kraken","kucoin","bingx","poloniex","bitrue","crypto.com","upbit","wazirx","bitmart","bitmex","coinex","hotbit"];
        return !cexNames.some(c => (t.title || "").toLowerCase().includes(c));
      }));
      setAnomalies(anRes.anomalies ?? []);
      setProjects(pRes.projects ?? []);
      setHealth(hRes.providers ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Generate data-driven events
  const events: {
    badge: string;
    badgeColor: string;
    headline: string;
    source: string;
    meta: string;
  }[] = [];

  // Anomaly events
  anomalies.forEach((a) => {
    events.push({
      badge: "DATA ALERT",
      badgeColor: "#dc2626",
      headline: a.description,
      source: "AnomalyDetector",
      meta: `Severity ${a.severity}/3${a.targetName ? " \u00b7 " + a.targetName : ""}`,
    });
  });

  // Data-driven events from projects
  const eco = projects.filter((p) => !p.classification || p.classification === "solana_ecosystem");
  const sorted = [...eco].sort((a, b) => (b.metrics?.tvl ?? 0) - (a.metrics?.tvl ?? 0));
  if (sorted[0]) {
    events.push({
      badge: "MARKET",
      badgeColor: "#2563eb",
      headline: `${sorted[0].name} leads Solana DeFi with ${fmtUsd(sorted[0].metrics?.tvl)} TVL`,
      source: "DeFiLlama",
      meta: `Category: ${sorted[0].category}`,
    });
  }
  const byVol = [...eco].sort((a, b) => (b.metrics?.volume24h ?? 0) - (a.metrics?.volume24h ?? 0));
  if (byVol[0] && byVol[0].metrics?.volume24h) {
    events.push({
      badge: "DATA ALERT",
      badgeColor: "#d97706",
      headline: `${byVol[0].name} records ${fmtUsd(byVol[0].metrics?.volume24h)} in 24h volume`,
      source: "DeFiLlama",
      meta: "24h DEX volume",
    });
  }
  // Top gainer
  const gainers = [...eco]
    .filter((p) => p.change24h !== undefined && p.change24h > 0)
    .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  if (gainers[0]) {
    events.push({
      badge: "BREAKING",
      badgeColor: "#059669",
      headline: `${gainers[0].name} up ${gainers[0].change24h?.toFixed(1)}% in 24h`,
      source: "DeFiLlama",
      meta: `Category: ${gainers[0].category}`,
    });
  }
  // Category insight
  const catMap = new Map<string, number>();
  eco.forEach((p) => catMap.set(p.category, (catMap.get(p.category) ?? 0) + 1));
  const topCat = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    events.push({
      badge: "ECOSYSTEM",
      badgeColor: "#7c3aed",
      headline: `${topCat[0]} is the largest Solana sector with ${topCat[1]} protocols`,
      source: "Insight",
      meta: `Out of ${eco.length} ecosystem projects`,
    });
  }

  // Source health events
  health.forEach((h) => {
    if (h.status === "unavailable") {
      events.push({
        badge: "NETWORK",
        badgeColor: "#dc2626",
        headline: `${h.id} data source is currently unavailable`,
        source: "Insight Health Monitor",
        meta: `Status: ${h.status}`,
      });
    }
  });

  // Timeline events
  timeline.forEach((t, i) => {
    events.push({
      badge: i === 0 ? "BREAKING" : "NEWS",
      badgeColor: i === 0 ? "#dc2626" : "#7c3aed",
      headline: t.title,
      source: t.source,
      meta: t.confidence,
    });
  });

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "32px 24px 16px" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
          }}
        >
          Solana Now
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 4 }}>
          Real-time intelligence feed \u2014 breaking events, data alerts, network status
        </p>
        <button
          onClick={() => void load()}
          style={{
            marginTop: 8,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--brown)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          \u21BB Refresh
        </button>
      </div>

      <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 24px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            Loading feed...
          </div>
        )}

        {!loading && (
          <>
            {/* Source health bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {health.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: h.status === "healthy" ? "var(--green)" : "var(--red)",
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {h.id}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: h.status === "healthy" ? "var(--green)" : "var(--red)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {h.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Intelligence feed */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {events.slice(0, 20).map((ev, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "14px 16px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                      marginTop: 2,
                      background: `${ev.badgeColor}15`,
                      color: ev.badgeColor,
                      border: `1px solid ${ev.badgeColor}40`,
                    }}
                  >
                    {ev.badge}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text)",
                        lineHeight: 1.35,
                      }}
                    >
                      {ev.headline}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 4,
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <span style={{ color: "var(--brown)" }}>{ev.source}</span>
                      <span>\u00b7</span>
                      <span>{ev.meta}</span>
                    </div>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "var(--text-muted)",
                    fontSize: 14,
                  }}
                >
                  No intelligence items yet. Trigger a refresh to populate the feed.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
