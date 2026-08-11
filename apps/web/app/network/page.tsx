"use client";

import { useState, useEffect, useCallback } from "react";
import { useCopilot } from "../../components/Copilot";
import { InsightChart } from "../../components/InsightChart";

// ── Types matching /api/network-metrics response ──

interface TopValidator {
  rank: number;
  votePubkey: string;
  activatedStake: number;
  stakePercent: number;
  commission: number;
  lastVote: number;
  epochVoteAccount: boolean;
}

interface NetworkData {
  timestamp: string;
  rpc: {
    epoch: {
      epoch: number;
      slotIndex: number;
      slotsInEpoch: number;
      blockHeight: number;
      transactionCount: number;
      progress: number;
    } | null;
    validators: {
      active: number;
      delinquent: number;
      total: number;
      delinquencyRate: number;
      totalStake: number;
      delinquentStake: number;
      avgCommission: number;
      topValidators: TopValidator[];
    } | null;
    tps: {
      current: number;
      avgSlotTime: number;
      samples: number;
      history: { slot: number; tps: number; slotTime: number }[];
    } | null;
    inflation: { total: number; validator: number; foundation: number } | null;
    supply: { total: number; circulating: number; nonCirculating: number } | null;
    clusterNodes: number | null;
    medianFee: {
      medianLamports: number;
      avgLamports: number;
      maxLamports: number;
      minLamports: number;
      samples: number;
      medianTotalFee: number;
    } | null;
    endpoint: string;
  };
  upcomingUpgrades: { name: string; description: string; status: string; simd: string }[];
  sources: Record<string, string>;
}

interface Anomaly {
  id: string;
  type: string;
  severity: number;
  title: string;
  description: string;
}

// ── Format helpers ──

function fmtNum(v: number | undefined | null): string {
  if (v === undefined || v === null) return "\u2014";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function fmtSol(lamports: number): string {
  return (lamports / 1e9).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null) return "\u2014";
  return `${v.toFixed(digits)}%`;
}

function truncPubkey(pk: string): string {
  if (!pk) return "\u2014";
  return `${pk.slice(0, 4)}\u2026${pk.slice(-4)}`;
}

// ── Style constants ──

const rule = { borderTop: "1px solid var(--border)", margin: "24px 0" } as const;
const sectionHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text)",
};
const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};
const monoNum: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  color: "var(--text)",
};

// ── Page Component ──

export default function NetworkPage() {
  const { setPageContext } = useCopilot();
  const [data, setData] = useState<NetworkData | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPageContext(
      "[Network] Solana network metrics — TPS, slot time, epoch progress, validators, delinquency, inflation, median fees, cluster nodes, anomalies, upcoming upgrades.",
    );
  }, [setPageContext]);

  const load = useCallback(async () => {
    try {
      const [res, anomRes] = await Promise.all([
        fetch("/api/network-metrics"),
        fetch("/api/anomalies")
          .then((r) => r.json())
          .catch(() => ({ anomalies: [] })),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NetworkData;
      setData(json);
      setAnomalies(anomRes.anomalies ?? []);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rpc = data?.rpc;
  const tpsData = rpc?.tps;
  const epoch = rpc?.epoch;
  const validators = rpc?.validators;
  const inflation = rpc?.inflation;
  const medianFee = rpc?.medianFee;

  const tpsChart =
    tpsData?.history?.map((h) => ({
      label: h.slot.toString(),
      value: h.tps,
    })) ?? [];

  const epochProgress = epoch?.progress ?? 0;

  return (
    <div className="main-content">
      <div style={{ maxWidth: "none", margin: 0, padding: "32px 24px" }}>
        {/* Header */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
          }}
        >
          Network
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
          Solana network performance, validators, and infrastructure
        </p>

        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            Loading network data...
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            Data unavailable. Solana RPC may be rate-limited.
          </div>
        )}

        {!loading && !error && rpc && (
          <>
            <div style={rule} />

            {/* ── 1. Metric Strip ── */}
            <div
              style={{
                display: "flex",
                gap: 0,
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {[
                { l: "TPS", v: tpsData ? fmtNum(tpsData.current) : "\u2014" },
                { l: "Slot Time", v: tpsData ? `${tpsData.avgSlotTime.toFixed(2)}s` : "\u2014" },
                { l: "Epoch", v: epoch ? epoch.epoch.toString() : "\u2014" },
                { l: "Block Height", v: epoch ? fmtNum(epoch.blockHeight) : "\u2014" },
                {
                  l: "Validators",
                  v: validators ? `${validators.active}/${validators.total}` : "\u2014",
                },
                { l: "Inflation", v: inflation ? fmtPct(inflation.total * 100) : "\u2014" },
                {
                  l: "Median Fee",
                  v: medianFee ? `${medianFee.medianTotalFee} lamports` : "\u2014",
                },
                {
                  l: "Cluster Nodes",
                  v: rpc.clusterNodes != null ? rpc.clusterNodes.toString() : "\u2014",
                },
              ].map((m, i, arr) => (
                <div
                  key={m.l}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={label}>{m.l}</div>
                  <div style={monoNum}>{m.v}</div>
                </div>
              ))}
            </div>

            <div style={rule} />

            {/* ── 2. TPS History Chart ── */}
            <div style={sectionHeader}>TPS History</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 8px" }}>
              Transactions per second from recent performance samples
            </p>
            {tpsChart.length > 0 ? (
              <InsightChart
                data={tpsChart}
                type="line"
                height={200}
                color="var(--accent)"
                formatValue={(v) => `${v.toFixed(0)} tps`}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                TPS data unavailable.
              </div>
            )}

            <div style={rule} />

            {/* ── 3. Epoch Progress ── */}
            <div style={sectionHeader}>Epoch Progress</div>
            {epoch ? (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  <span>
                    Epoch {epoch.epoch} &middot; Slot {fmtNum(epoch.slotIndex)} /{" "}
                    {fmtNum(epoch.slotsInEpoch)}
                  </span>
                  <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                    {epochProgress.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 6,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${epochProgress}%`,
                      height: "100%",
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 24,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>Block Height: {fmtNum(epoch.blockHeight)}</span>
                  <span>Tx Count: {fmtNum(epoch.transactionCount)}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: 20, color: "var(--text-muted)" }}>Epoch data unavailable.</div>
            )}

            <div style={rule} />

            {/* ── 4. Validator Table ── */}
            <div style={sectionHeader}>Top Validators</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 8px" }}>
              Sorted by stake descending
            </p>
            {validators && validators.topValidators.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ ...label, textAlign: "left", padding: "6px 8px" }}>Rank</th>
                      <th style={{ ...label, textAlign: "left", padding: "6px 8px" }}>Validator</th>
                      <th style={{ ...label, textAlign: "right", padding: "6px 8px" }}>
                        Stake (SOL)
                      </th>
                      <th style={{ ...label, textAlign: "right", padding: "6px 8px" }}>Stake %</th>
                      <th style={{ ...label, textAlign: "right", padding: "6px 8px" }}>
                        Commission
                      </th>
                      <th style={{ ...label, textAlign: "right", padding: "6px 8px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validators.topValidators.map((v) => (
                      <tr key={v.votePubkey} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>{v.rank}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text)" }}>
                          {truncPubkey(v.votePubkey)}
                        </td>
                        <td
                          style={{ padding: "6px 8px", textAlign: "right", color: "var(--text)" }}
                        >
                          {fmtSol(v.activatedStake)}
                        </td>
                        <td
                          style={{ padding: "6px 8px", textAlign: "right", color: "var(--accent)" }}
                        >
                          {v.stakePercent.toFixed(2)}%
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
                            textAlign: "right",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {v.commission}%
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: v.epochVoteAccount ? "var(--green)" : "var(--red)",
                            }}
                          >
                            {v.epochVoteAccount ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 20, color: "var(--text-muted)" }}>
                Validator data unavailable.
              </div>
            )}

            <div style={rule} />

            {/* ── 5. Delinquency ── */}
            <div style={sectionHeader}>Delinquency</div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 14 }}>
              {validators ? (
                <span
                  style={{
                    color: validators.delinquencyRate > 5 ? "var(--red)" : "var(--text)",
                  }}
                >
                  {validators.delinquent} delinquent ({validators.delinquencyRate.toFixed(1)}%)
                </span>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Data unavailable.</span>
              )}
            </div>

            <div style={rule} />

            {/* ── 6. Inflation ── */}
            <div style={sectionHeader}>Inflation</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: "var(--text)",
              }}
            >
              {inflation ? (
                <>
                  Total:{" "}
                  <span style={{ color: "var(--accent)" }}>{fmtPct(inflation.total * 100)}</span>{" "}
                  &middot; Validator:{" "}
                  <span style={{ color: "var(--accent)" }}>
                    {fmtPct(inflation.validator * 100)}
                  </span>{" "}
                  &middot; Foundation:{" "}
                  <span style={{ color: "var(--accent)" }}>
                    {fmtPct(inflation.foundation * 100)}
                  </span>
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Data unavailable.</span>
              )}
            </div>

            <div style={rule} />

            {/* ── 7. Median Fee ── */}
            <div style={sectionHeader}>Median Fee</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: "var(--text)",
              }}
            >
              {medianFee ? (
                <>
                  Median:{" "}
                  <span style={{ color: "var(--accent)" }}>
                    {medianFee.medianTotalFee} lamports
                  </span>{" "}
                  &middot; Avg:{" "}
                  <span style={{ color: "var(--accent)" }}>
                    {Math.round(medianFee.avgLamports + 5000)} lamports
                  </span>{" "}
                  &middot; {medianFee.samples} samples
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Data unavailable.</span>
              )}
            </div>

            <div style={rule} />

            {/* ── 8. Cluster Nodes ── */}
            <div style={sectionHeader}>Cluster Nodes</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: "var(--text)",
              }}
            >
              {rpc.clusterNodes != null ? (
                <>
                  <span style={{ color: "var(--accent)" }}>{rpc.clusterNodes}</span> nodes
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Data unavailable.</span>
              )}
            </div>

            <div style={rule} />

            {/* ── Anomalies (moved from Dashboard) ── */}
            <div style={sectionHeader}>Anomalies</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 12px" }}>
              Automated detection of unusual on-chain / metric shifts
            </p>
            {anomalies.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {anomalies.map((a) => (
                  <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontFamily: "var(--font-mono)",
                          color:
                            a.severity >= 3
                              ? "var(--red)"
                              : a.severity >= 2
                                ? "var(--yellow)"
                                : "var(--text-muted)",
                        }}
                      >
                        {a.severity >= 3 ? "Critical" : a.severity >= 2 ? "Warning" : "Info"}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                        {a.title}
                      </span>
                    </div>
                    {a.description && (
                      <span
                        style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}
                      >
                        {a.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13 }}>
                No anomalies detected.
              </div>
            )}

            <div style={rule} />

            {/* ── 9. Upcoming Upgrades ── */}
            <div style={sectionHeader}>Upcoming Upgrades</div>
            <div style={{ marginTop: 12 }}>
              {data?.upcomingUpgrades?.map((u) => (
                <div
                  key={u.simd}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                      {u.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 6px",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {u.simd}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 6px",
                        background:
                          u.status === "Active"
                            ? "var(--green)"
                            : u.status === "Proposed"
                              ? "var(--yellow)"
                              : "var(--accent)",
                        color: u.status === "Proposed" ? "var(--text)" : "var(--bg)",
                        borderRadius: "var(--radius)",
                      }}
                    >
                      {u.status}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      margin: "4px 0 0",
                      lineHeight: 1.5,
                    }}
                  >
                    {u.description}
                  </p>
                </div>
              ))}
            </div>

            <div style={rule} />

            {/* ── 10. Source Attribution ── */}
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Source: Solana RPC (multi-endpoint fallback) &middot; DeFiLlama
            </div>
          </>
        )}
      </div>
    </div>
  );
}
