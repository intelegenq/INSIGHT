"use client";

import { useState, useEffect, useCallback } from "react";
import { InsightChart, Sparkline } from "../../components/InsightChart";
import { useCopilot } from "../../components/Copilot";

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

function fmtUsd(v: number | undefined): string {
  if (!v) return "\u2014";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number | undefined): string {
  if (v === undefined || v === null) return "\u2014";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

const rule = { borderTop: "2px solid #3d2e1e", margin: "24px 0" };
const sectionHeader = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text)",
};
const label = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};
const num = { fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" };

export default function MarketsPage() {
  const { setPageContext } = useCopilot();
  useEffect(() => {
    setPageContext("[Markets] SOL market data, price chart, volume, market cap, performance.");
  }, [setPageContext]);

  const [priceData, setPriceData] = useState<SolanaPriceData | null>(null);
  const [health, setHealth] = useState<HealthProvider[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, hRes] = await Promise.all([
        fetch(`/api/solana-price?days=${days}`)
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/health")
          .then((r) => r.json())
          .catch(() => ({ providers: [] })),
      ]);
      if (pRes) setPriceData(pRes);
      setHealth(hRes.providers ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const c = priceData?.current;
  const priceChart =
    priceData?.prices?.map((p) => ({
      label: new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: p.price,
    })) ?? [];
  const volChart =
    priceData?.volumes?.map((v) => ({
      label: new Date(v.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: v.value,
    })) ?? [];
  const mcChart =
    priceData?.marketCaps?.map((m) => ({
      label: new Date(m.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: m.value,
    })) ?? [];
  const spark = priceData?.prices?.slice(-30).map((p) => p.price) ?? [];

  return (
    <div style={{ background: "var(--linen)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "none", margin: 0, padding: "32px 24px 0" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
          }}
        >
          Markets
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
          SOL price, volume, market cap, and performance
        </p>
      </div>

      <div style={{ maxWidth: "none", margin: 0, padding: "0 24px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            Loading market data...
          </div>
        )}

        {!loading && c && (
          <>
            {/* Price header */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 24 }}>
              <div>
                <div style={label}>SOL / USD</div>
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text)",
                    lineHeight: 1,
                  }}
                >
                  ${c.price.toFixed(2)}
                </div>
              </div>
              <div style={{ paddingBottom: 6 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    color: (c.change24h ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                  }}
                >
                  {(c.change24h ?? 0) >= 0 ? "\u25B2" : "\u25BC"} {fmtPct(c.change24h)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>24h</div>
              </div>
              {spark.length > 1 && (
                <div style={{ width: 120, height: 40, paddingBottom: 6 }}>
                  <Sparkline
                    data={spark}
                    color={(c.change24h ?? 0) >= 0 ? "#059669" : "#dc2626"}
                    height={40}
                  />
                </div>
              )}
            </div>

            {/* Stats strip */}
            <div
              style={{
                display: "flex",
                gap: 0,
                marginTop: 16,
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {[
                { l: "Market Cap", v: fmtUsd(c.marketCap) },
                { l: "24h Volume", v: fmtUsd(c.volume) },
                {
                  l: "Circ. Supply",
                  v: c.circulatingSupply ? `${(c.circulatingSupply / 1e9).toFixed(1)}B` : "\u2014",
                },
                { l: "24h High", v: `$${c.high24h?.toFixed(2) ?? "\u2014"}` },
                { l: "24h Low", v: `$${c.low24h?.toFixed(2) ?? "\u2014"}` },
              ].map((s, i) => (
                <div
                  key={s.l}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRight: i < 4 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={label}>{s.l}</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text)",
                      marginTop: 2,
                    }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>

            {/* Performance strip */}
            <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
              {[
                { l: "24h", v: c.change24h },
                { l: "7d", v: c.change7d },
                { l: "30d", v: c.change30d },
              ].map((p, i) => (
                <div key={p.l} style={{ flex: 1, padding: "8px 12px" }}>
                  <div style={label}>{p.l}</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      color: (p.v ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {fmtPct(p.v)}
                  </div>
                </div>
              ))}
            </div>

            <div style={rule} />

            {/* Price chart */}
            <div style={sectionHeader}>SOL Price \u2014 {days}D</div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
                  {[1, 7, 30, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      style={{
                        padding: "3px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        background: days === d ? "var(--text)" : "transparent",
                        color: days === d ? "var(--linen)" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                        borderRight: d < 90 ? "none" : "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      {d === 1 ? "1D" : d === 7 ? "7D" : d === 30 ? "30D" : "90D"}
                    </button>
                  ))}
                </div>
                {priceChart.length > 0 ? (
                  <InsightChart
                    data={priceChart}
                    type="area"
                    color="var(--brown)"
                    height={300}
                    formatValue={(v) => `$${v.toFixed(2)}`}
                  />
                ) : (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                    Price data unavailable.
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                marginTop: 4,
              }}
            >
              Source: CoinGecko \u00b7 {priceChart.length} data points
            </div>

            <div style={rule} />

            {/* Volume chart */}
            <div style={sectionHeader}>Trading Volume</div>
            {volChart.length > 0 ? (
              <InsightChart
                data={volChart}
                type="bar"
                color="var(--brown)"
                height={200}
                formatValue={(v) => fmtUsd(v)}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                Volume data unavailable.
              </div>
            )}

            <div style={rule} />

            {/* Market cap chart */}
            <div style={sectionHeader}>Market Cap</div>
            {mcChart.length > 0 ? (
              <InsightChart
                data={mcChart}
                type="area"
                color="var(--brown)"
                height={200}
                formatValue={(v) => fmtUsd(v)}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                Market cap data unavailable.
              </div>
            )}

            <div style={rule} />

            {/* Data sources */}
            <div style={sectionHeader}>Data Sources</div>
            <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
              {health.map((h) => (
                <div
                  key={h.id}
                  style={{ flex: 1, padding: "8px 12px", borderRight: "1px solid var(--border)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: h.status === "healthy" ? "var(--green)" : "var(--red)",
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                      {h.id}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: h.status === "healthy" ? "var(--green)" : "var(--red)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {h.status}
                  </div>
                </div>
              ))}
            </div>

            <div style={rule} />

            {/* Provenance */}
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              SOL price, market cap, and volume data from CoinGecko free API. ETF flow data and
              institutional activity are not available via free API \u2014 shown as unavailable
              rather than fabricated. All metrics are evidence-backed and traceable to their source.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
