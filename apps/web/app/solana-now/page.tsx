"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface FeedItem {
  id: string;
  time: string;
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
  pctChange?: number;
  evidenceIds: string[];
  detectedAt: string;
}

interface TimelineEntry {
  id: string;
  time: string;
  title: string;
  source: string;
  confidence: string;
}

export default function SolanaNowPage() {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tlRes, anRes] = await Promise.all([
        fetch("/api/pulse")
          .then((r) => r.json())
          .catch(() => ({ timeline: [] })),
        fetch("/api/anomalies")
          .then((r) => r.json())
          .catch(() => ({ anomalies: [] })),
      ]);
      setTimeline(tlRes.timeline ?? []);
      setAnomalies(anRes.anomalies ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const badgeType = (idx: number, isAnomaly: boolean): string => {
    if (isAnomaly) return "alert";
    if (idx === 0) return "breaking";
    if (idx <= 2) return "new";
    return "event";
  };

  const badgeLabel = (idx: number, isAnomaly: boolean): string => {
    if (isAnomaly) return "DATA ALERT";
    if (idx === 0) return "BREAKING";
    if (idx <= 2) return "NEW";
    return "EVENT";
  };

  return (
    <div>
      <div className="page-hero">
        <p className="eyebrow">SOLANA NOW</p>
        <h1 style={{ fontSize: 32 }}>Real-time intelligence feed</h1>
        <p className="subtitle">
          Breaking events, data alerts, and ecosystem updates — all evidence-backed
        </p>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading feed...</div>}

        {!loading && (
          <>
            {/* Data Alerts from Anomaly Detection */}
            {anomalies.length > 0 && (
              <div className="terminal-section">
                <div className="section-header">
                  <div>
                    <div className="section-title">Data Alerts</div>
                    <div className="section-subtitle">
                      Machine-detected anomalies from snapshot comparison
                    </div>
                  </div>
                </div>
                <div className="solana-now">
                  {anomalies.map((a) => (
                    <div key={a.id} className="feed-item">
                      <span className="feed-badge alert">DATA ALERT</span>
                      <div className="feed-content">
                        <div className="feed-headline">{a.description}</div>
                        <div className="feed-meta">
                          <span className="feed-source">AnomalyDetector</span>
                          <span>·</span>
                          <span>Severity {a.severity}/3</span>
                          {a.targetName && (
                            <>
                              <span>·</span>
                              <span className="feed-category">{a.targetName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Feed */}
            <div className="terminal-section">
              <div className="section-header">
                <div>
                  <div className="section-title">Ecosystem Timeline</div>
                  <div className="section-subtitle">Protocol events and ecosystem updates</div>
                </div>
                <button className="t-btn sm" onClick={() => void load()}>
                  Refresh
                </button>
              </div>
              <div className="solana-now">
                {timeline.map((t, i) => (
                  <div key={t.id} className="feed-item">
                    <span className={`feed-badge ${badgeType(i, false)}`}>
                      {badgeLabel(i, false)}
                    </span>
                    <div className="feed-content">
                      <div className="feed-headline">{t.title}</div>
                      <div className="feed-meta">
                        <span className="feed-source">{t.source}</span>
                        <span>·</span>
                        <span>{t.confidence}</span>
                        {t.time && (
                          <>
                            <span>·</span>
                            <span>{new Date(t.time).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {timeline.length === 0 && (
                  <div className="t-empty">
                    No timeline events yet. Trigger a refresh via{" "}
                    <Link href="/api/refresh" className="t-card-link">
                      /api/refresh
                    </Link>{" "}
                    to populate the feed with live data.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
