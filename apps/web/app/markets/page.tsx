"use client";

import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";
import { InsightChart, Sparkline } from "../../components/InsightChart";

// ── Types ─────────────────────────────────────────────────────

interface PricePoint {
  timestamp: string;
  price: number;
}
interface MarketCapPoint {
  timestamp: string;
  value: number;
}
interface VolumePoint {
  timestamp: string;
  value: number;
}
interface CurrentMarket {
  price: number;
  marketCap: number;
  volume: number;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  circulatingSupply: number;
  high24h: number;
  low24h: number;
  // Fields the API may add later; shown as unavailable when absent
  fdv?: number;
  totalSupply?: number;
  change90d?: number;
  change1y?: number;
}
interface SolanaPriceData {
  prices: PricePoint[];
  marketCaps: MarketCapPoint[];
  volumes: VolumePoint[];
  current: CurrentMarket | null;
}
interface HealthProvider {
  id: string;
  status: string;
}

// ── Format helpers ────────────────────────────────────────────

function fmtUsd(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtNum(v: number | undefined | null, suffix = ""): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B${suffix}`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M${suffix}`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K${suffix}`;
  return `${v.toLocaleString()}${suffix}`;
}

function fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtDateLabel(ts: string, days: number): string {
  const d = new Date(ts);
  if (days <= 1) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Timeframe options ─────────────────────────────────────────

const TIMEFRAMES = [
  { label: "1D", val: 1 },
  { label: "7D", val: 7 },
  { label: "30D", val: 30 },
  { label: "90D", val: 90 },
  { label: "1Y", val: 365 },
] as const;

// ── Source metadata ───────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; desc: string }> = {
  coingecko: {
    label: "CoinGecko",
    desc: "SOL price, market cap, volume, supply",
  },
  defillama: {
    label: "DeFiLlama",
    desc: "Ecosystem TVL & protocol metrics",
  },
  "solana-rpc": {
    label: "Solana RPC",
    desc: "On-chain epoch & network data",
  },
};

const DEFAULT_SOURCES = [
  { id: "coingecko", status: "unknown" },
  { id: "defillama", status: "unknown" },
  { id: "solana-rpc", status: "unknown" },
];

// ── Inline style fragments ────────────────────────────────────

const heroPriceStyle: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 800,
  fontFamily: "var(--font-mono)",
  letterSpacing: "-0.03em",
  color: "var(--text)",
  lineHeight: 1,
};

const heroChangeStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  color: "var(--text)",
  lineHeight: 1.2,
};

const metricSubStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
};

const sourceDotStyle = (status: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0,
  background:
    status === "healthy"
      ? "var(--green)"
      : status === "degraded"
        ? "var(--yellow)"
        : status === "unknown"
          ? "var(--text-muted)"
          : "var(--red)",
});

const perfPillStyle = (v: number | undefined): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "10px 14px",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  flex: 1,
  minWidth: 0,
});

const perfValueStyle = (v: number | undefined): React.CSSProperties => ({
  fontSize: 16,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  color: v === undefined ? "var(--text-muted)" : v >= 0 ? "var(--green)" : "var(--red)",
});

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "var(--text)",
  letterSpacing: "-0.01em",
};

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  marginTop: 2,
};

const provenanceStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.65,
};

// ── Component ─────────────────────────────────────────────────

export default function MarketsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext(
      "[Markets] User is viewing full SOL market analytics: price chart, volume chart, market cap chart, performance metrics (24h/7d/30d/90d/1y), supply data, and data source health.",
    );
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [pRes, hRes] = await Promise.all([
        fetch(`/api/solana-price?days=${days}`)
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/health")
          .then((r) => r.json())
          .catch(() => ({ providers: [] })),
      ]);
      if (pRes && !pRes.error) setPriceData(pRes);
      else setPriceData(null);
      setHealth(hRes.providers ?? []);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = priceData?.current ?? null;
  const prices = priceData?.prices ?? [];
  const marketCaps = priceData?.marketCaps ?? [];
  const volumes = priceData?.volumes ?? [];

  // Build chart datasets
  const priceChart = prices.map((p) => ({
    label: fmtDateLabel(p.timestamp, days),
    value: p.price,
  }));
  const volumeChart = volumes.map((v) => ({
    label: fmtDateLabel(v.timestamp, days),
    value: v.value,
  }));
  const mcapChart = marketCaps.map((m) => ({
    label: fmtDateLabel(m.timestamp, days),
    value: m.value,
  }));

  // Sparkline data for hero
  const sparkPrices = prices.slice(-30).map((p) => p.price);

  // Resolve health providers, merging defaults with API response
  const resolvedProviders = (() => {
    if (health.length > 0) return health;
    return DEFAULT_SOURCES as HealthProvider[];
  })();

  // Performance strip
  const perfMetrics = [
    { label: "24h", value: current?.change24h },
    { label: "7d", value: current?.change7d },
    { label: "30d", value: current?.change30d },
    { label: "90d", value: current?.change90d },
    { label: "1y", value: current?.change1y },
  ];

  // Change indicator helper
  const changeColor = (v: number | undefined) =>
    v === undefined ? "var(--text-muted)" : v >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div>
      {/* ── Hero ── */}
      <div className="page-hero">
        <p className="eyebrow">MARKETS</p>
        <h1 style={{ fontSize: 32, marginBottom: 4 }}>SOL market analytics</h1>
        <p className="subtitle">Price, volume, market cap, performance & source attribution</p>
      </div>

      <div className="terminal-main">
        {loading && <div className="t-loading">Loading market data…</div>}

        {!loading && error && (
          <div className="t-empty">Failed to load market data. Please try again.</div>
        )}

        {!loading && !error && (
          <>
            {/* ── 1. Metric Header ── */}
            <div className="chart-container" style={{ marginBottom: 16, padding: 24 }}>
              {/* Big price + change */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={metricLabelStyle}>SOL / USD</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={heroPriceStyle}>
                      {current ? `$${current.price.toFixed(2)}` : "—"}
                    </span>
                    {current?.change24h !== undefined && (
                      <span
                        style={{
                          ...heroChangeStyle,
                          color: changeColor(current.change24h),
                        }}
                      >
                        {fmtPct(current.change24h)}{" "}
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>
                          24h
                        </span>
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Source: CoinGecko ·{" "}
                    {current
                      ? `Updated ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                      : "Awaiting data"}
                  </span>
                </div>
                {/* Sparkline */}
                {sparkPrices.length > 1 && (
                  <div style={{ width: 180, height: 48 }}>
                    <Sparkline data={sparkPrices} color="var(--accent)" height={48} />
                  </div>
                )}
              </div>

              {/* Metric grid */}
              <div
                className="terminal-grid terminal-grid-4"
                style={{
                  gap: 1,
                  background: "var(--border)",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                }}
              >
                <MetricCell
                  label="Market Cap"
                  value={fmtUsd(current?.marketCap)}
                  sub={
                    current?.change24h !== undefined
                      ? `${fmtPct(current.change24h)} 24h`
                      : undefined
                  }
                  subColor={changeColor(current?.change24h)}
                />
                <MetricCell
                  label="FDV"
                  value={current?.fdv ? fmtUsd(current.fdv) : "Data unavailable"}
                  sub={current?.fdv ? "Fully diluted" : "Not in free API"}
                />
                <MetricCell
                  label="Circulating Supply"
                  value={
                    current?.circulatingSupply ? fmtNum(current.circulatingSupply, " SOL") : "—"
                  }
                  sub={
                    current?.circulatingSupply
                      ? `${(current.circulatingSupply / 1e9).toFixed(1)}B SOL`
                      : undefined
                  }
                />
                <MetricCell
                  label="Total Supply"
                  value={
                    current?.totalSupply ? fmtNum(current.totalSupply, " SOL") : "Data unavailable"
                  }
                  sub={current?.totalSupply ? "Max supply" : "Not in free API"}
                />
                <MetricCell
                  label="24h Volume"
                  value={fmtUsd(current?.volume)}
                  sub="Trading volume"
                />
                <MetricCell
                  label="24h High"
                  value={current?.high24h ? `$${current.high24h.toFixed(2)}` : "—"}
                />
                <MetricCell
                  label="24h Low"
                  value={current?.low24h ? `$${current.low24h.toFixed(2)}` : "—"}
                />
                <MetricCell
                  label="24h Range"
                  value={
                    current?.high24h && current?.low24h
                      ? `$${current.low24h.toFixed(2)} – $${current.high24h.toFixed(2)}`
                      : "—"
                  }
                  sub={
                    current?.high24h && current?.low24h
                      ? `${(((current.high24h - current.low24h) / current.low24h) * 100).toFixed(1)}% spread`
                      : undefined
                  }
                />
              </div>
            </div>

            {/* ── 2. SOL Price Chart ── */}
            <div className="chart-container" style={{ marginBottom: 16 }}>
              <div className="section-header">
                <div>
                  <div style={sectionTitleStyle}>SOL Price</div>
                  <div style={sectionSubtitleStyle}>
                    Source: CoinGecko · {priceChart.length} data points ·{" "}
                    {days <= 1 ? "hourly" : days <= 30 ? "daily" : "interval"} candles
                  </div>
                </div>
                <div className="timeframe-controls">
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t.val}
                      className={`timeframe-btn ${days === t.val ? "active" : ""}`}
                      onClick={() => setDays(t.val)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Current price + change prominently above chart */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 14,
                  marginBottom: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text)",
                  }}
                >
                  {current ? `$${current.price.toFixed(2)}` : "—"}
                </span>
                {current?.change24h !== undefined && (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: changeColor(current.change24h),
                    }}
                  >
                    {fmtPct(current.change24h)} (24h)
                  </span>
                )}
                {current?.change7d !== undefined && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      color: changeColor(current.change7d),
                    }}
                  >
                    7d: {fmtPct(current.change7d)}
                  </span>
                )}
              </div>
              {priceChart.length > 0 ? (
                <InsightChart
                  data={priceChart}
                  type="area"
                  color="var(--accent)"
                  height={320}
                  formatValue={(v) => `$${v.toFixed(2)}`}
                />
              ) : (
                <div className="t-empty">Price data unavailable.</div>
              )}
            </div>

            {/* ── 3 & 4. Volume + Market Cap side by side ── */}
            <div className="terminal-grid terminal-grid-2" style={{ marginBottom: 16 }}>
              {/* Trading Volume */}
              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="section-header">
                  <div>
                    <div style={sectionTitleStyle}>Trading Volume</div>
                    <div style={sectionSubtitleStyle}>Source: CoinGecko · {days}D</div>
                  </div>
                  {current?.volume !== undefined && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent)",
                      }}
                    >
                      {fmtUsd(current.volume)}
                    </span>
                  )}
                </div>
                {volumeChart.length > 0 ? (
                  <InsightChart
                    data={volumeChart}
                    type="bar"
                    color="var(--violet)"
                    height={220}
                    formatValue={(v) => fmtUsd(v)}
                  />
                ) : (
                  <div className="t-empty">Volume data unavailable.</div>
                )}
              </div>

              {/* Market Cap */}
              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="section-header">
                  <div>
                    <div style={sectionTitleStyle}>Market Cap</div>
                    <div style={sectionSubtitleStyle}>Source: CoinGecko · {days}D</div>
                  </div>
                  {current?.marketCap !== undefined && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent)",
                      }}
                    >
                      {fmtUsd(current.marketCap)}
                    </span>
                  )}
                </div>
                {mcapChart.length > 0 ? (
                  <InsightChart
                    data={mcapChart}
                    type="area"
                    color="var(--blue)"
                    height={220}
                    formatValue={(v) => fmtUsd(v)}
                  />
                ) : (
                  <div className="t-empty">Market cap data unavailable.</div>
                )}
              </div>
            </div>

            {/* ── 5. Price Performance strip ── */}
            <div className="chart-container" style={{ marginBottom: 16 }}>
              <div className="section-header">
                <div>
                  <div style={sectionTitleStyle}>Price Performance</div>
                  <div style={sectionSubtitleStyle}>
                    Period-over-period returns · Source: CoinGecko
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {perfMetrics.map((m) => (
                  <div key={m.label} style={perfPillStyle(m.value)}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                      }}
                    >
                      {m.label}
                    </span>
                    <span style={perfValueStyle(m.value)}>{fmtPct(m.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 6. Data Sources ── */}
            <div className="terminal-section">
              <div className="section-header">
                <div>
                  <div style={sectionTitleStyle}>Data Sources</div>
                  <div style={sectionSubtitleStyle}>Live health status of upstream providers</div>
                </div>
              </div>
              <div className="terminal-grid terminal-grid-3">
                {resolvedProviders.map((p) => {
                  const meta = SOURCE_META[p.id] ?? {
                    label: p.id,
                    desc: "",
                  };
                  return (
                    <div key={p.id} style={cardStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span style={sourceDotStyle(p.status)} />
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--text)",
                          }}
                        >
                          {meta.label}
                        </span>
                        <span
                          className={`t-badge ${
                            p.status === "healthy"
                              ? "green"
                              : p.status === "degraded"
                                ? "yellow"
                                : p.status === "unknown"
                                  ? "muted"
                                  : "red"
                          }`}
                          style={{ marginLeft: "auto" }}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div style={metricSubStyle}>{meta.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 7. Data Provenance ── */}
            <div className="terminal-section">
              <div style={cardStyle}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 10,
                  }}
                >
                  Market Data Provenance & Limitations
                </div>
                <div style={provenanceStyle}>
                  <p style={{ marginTop: 0 }}>
                    <strong>SOL price, market cap, volume, and supply data</strong> are fetched live
                    from the{" "}
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                      CoinGecko free API
                    </span>
                    . Price history is available for 1D – 1Y ranges; volume and market cap charts
                    use the same source and timeframe.
                  </p>
                  <p>
                    <strong>ETF flow data and institutional activity</strong> are{" "}
                    <em>not available</em> through CoinGecko&apos;s free tier. These metrics are shown as
                    &ldquo;Data unavailable&rdquo; rather than fabricated or estimated.
                  </p>
                  <p>
                    <strong>FDV (fully diluted valuation) and total supply</strong> may not be
                    returned by the free API in all responses — when absent, they are labeled
                    accordingly. Circulating supply is available and shown in the metric header.
                  </p>
                  <p>
                    <strong>90d and 1y performance</strong> percentages depend on the CoinGecko
                    market data response; when the API does not return these fields (e.g.,
                    rate-limited or shorter history), they display as &ldquo;—&rdquo;.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    All metrics on this page are <strong>evidence-backed</strong> and traceable to
                    their upstream source. No data is synthesized or interpolated. If a source is
                    down, the corresponding section displays &ldquo;Data unavailable.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Metric cell sub-component ─────────────────────────────────

function MetricCell({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <span style={metricLabelStyle}>{label}</span>
      <span style={metricValueStyle}>{value}</span>
      {sub && (
        <span
          style={{
            ...metricSubStyle,
            ...(subColor ? { color: subColor, fontWeight: 600 } : {}),
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
