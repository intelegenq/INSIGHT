import { ok } from "../../../lib/api";

/**
 * GET /api/network-metrics — comprehensive Solana network data.
 *
 * Fetches directly from Solana RPC (multi-endpoint fallback) + DeFiLlama.
 * No provider system — direct fetch() for maximum reliability.
 *
 * Returns:
 * - epoch info (epoch, slot, block height, tx count)
 * - validators (active/delinquent count, stake, top validators, commission)
 * - TPS (from performance samples)
 * - inflation rate
 * - supply (total, circulating)
 * - cluster nodes
 * - stablecoin supply on Solana (from DeFiLlama)
 * - DEX volume (from DeFiLlama, total24h field)
 * - fees/revenue (from DeFiLlama, total24h field)
 */

const RPC_ENDPOINTS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

interface RpcResult<T> {
  endpoint: string;
  ok: boolean;
  data?: T;
  error?: string;
}

async function rpcCall<T>(
  method: string,
  params: unknown[] = [],
  timeout = 5000,
): Promise<RpcResult<T>> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      if (json.error) continue;
      return { endpoint, ok: true, data: json.result as T };
    } catch {
      // try next endpoint
    }
  }
  return { endpoint: "", ok: false, error: "All RPC endpoints failed" };
}

export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString();

  // Fire all RPC calls in parallel
  const [epochRes, voteRes, perfRes, inflationRes, supplyRes, nodesRes] = await Promise.all([
    rpcCall<{
      epoch: number;
      slotIndex: number;
      slotsInEpoch: number;
      blockHeight: number;
      transactionCount: number;
    }>("getEpochInfo", [{ commitment: "confirmed" }]),
    rpcCall<{ current: Validator[]; delinquent: Validator[] }>("getVoteAccounts"),
    rpcCall<
      Array<{ numSlots: number; numTransactions: number; samplePeriodSecs: number; slot: number }>
    >("getRecentPerformanceSamples", [20]),
    rpcCall<{ total: number; validator: number; foundation: number }>("getInflationRate"),
    rpcCall<{ total: number; circulating: number; nonCirculating: number }>("getSupply"),
    rpcCall<Array<{ gossip: string; version: string }>>("getClusterNodes"),
  ]);

  // Process epoch
  const epoch =
    epochRes.ok && epochRes.data
      ? {
          epoch: epochRes.data.epoch,
          slotIndex: epochRes.data.slotIndex,
          slotsInEpoch: epochRes.data.slotsInEpoch,
          blockHeight: epochRes.data.blockHeight,
          transactionCount: epochRes.data.transactionCount,
          progress:
            epochRes.data.slotsInEpoch > 0
              ? (epochRes.data.slotIndex / epochRes.data.slotsInEpoch) * 100
              : 0,
        }
      : null;

  // Process validators
  let validators = null;
  if (voteRes.ok && voteRes.data) {
    const current = voteRes.data.current || [];
    const delinquent = voteRes.data.delinquent || [];
    const totalStake = current.reduce((sum, v) => sum + (v.activatedStake || 0), 0);
    const delinqStake = delinquent.reduce((sum, v) => sum + (v.activatedStake || 0), 0);
    const avgCommission =
      current.length > 0
        ? current.reduce((sum, v) => sum + (v.commission || 0), 0) / current.length
        : 0;

    const topValidators = [...current]
      .sort((a, b) => (b.activatedStake || 0) - (a.activatedStake || 0))
      .slice(0, 20)
      .map((v, i) => ({
        rank: i + 1,
        votePubkey: v.votePubkey,
        activatedStake: v.activatedStake,
        stakePercent: totalStake > 0 ? ((v.activatedStake || 0) / totalStake) * 100 : 0,
        commission: v.commission,
        lastVote: v.lastVote,
        epochVoteAccount: v.epochVoteAccount,
      }));

    validators = {
      active: current.length,
      delinquent: delinquent.length,
      total: current.length + delinquent.length,
      delinquencyRate:
        current.length + delinquent.length > 0
          ? (delinquent.length / (current.length + delinquent.length)) * 100
          : 0,
      totalStake,
      delinquentStake: delinqStake,
      avgCommission,
      topValidators,
    };
  }

  // Process TPS
  let tps = null;
  if (perfRes.ok && perfRes.data && perfRes.data.length > 0) {
    const samples = perfRes.data;
    const totalTx = samples.reduce((sum, s) => sum + (s.numTransactions || 0), 0);
    const totalTime = samples.reduce((sum, s) => sum + (s.samplePeriodSecs || 0), 0);
    const totalSlots = samples.reduce((sum, s) => sum + (s.numSlots || 0), 0);
    tps = {
      current: totalTime > 0 ? totalTx / totalTime : 0,
      avgSlotTime: totalSlots > 0 ? totalTime / totalSlots : 0,
      samples: samples.length,
      history: samples.map((s) => ({
        slot: s.slot,
        tps: s.samplePeriodSecs > 0 ? s.numTransactions / s.samplePeriodSecs : 0,
        slotTime: s.numSlots > 0 ? s.samplePeriodSecs / s.numSlots : 0,
      })),
    };
  }

  // Process inflation
  const inflation =
    inflationRes.ok && inflationRes.data
      ? {
          total: inflationRes.data.total,
          validator: inflationRes.data.validator,
          foundation: inflationRes.data.foundation,
        }
      : null;

  // Process supply
  const supply =
    supplyRes.ok && supplyRes.data
      ? {
          total: supplyRes.data.total,
          circulating: supplyRes.data.circulating,
          nonCirculating: supplyRes.data.nonCirculating,
        }
      : null;

  // Process cluster nodes
  const clusterNodes = nodesRes.ok && nodesRes.data ? nodesRes.data.length : null;

  // Fetch DeFiLlama + extra RPC data in parallel
  const [stablecoinData, dexVolumeData, feesData, rwaData, prioritizationFees] = await Promise.all([
    fetchStablecoinSupply(),
    fetchDexVolume(),
    fetchFeesRevenue(),
    fetchRwaProtocols(),
    rpcCall<Array<{ prioritizationFee: number; slot: number }>>("getRecentPrioritizationFees", [
      [],
    ]),
  ]);

  // Process prioritization fees for median fee calculation
  let medianFee = null;
  if (prioritizationFees.ok && prioritizationFees.data && prioritizationFees.data.length > 0) {
    const fees = prioritizationFees.data.map((f) => f.prioritizationFee || 0).sort((a, b) => a - b);
    const mid = Math.floor(fees.length / 2);
    medianFee = {
      medianLamports: fees[mid],
      avgLamports: fees.reduce((sum, f) => sum + f, 0) / fees.length,
      maxLamports: fees[fees.length - 1],
      minLamports: fees[0],
      samples: fees.length,
      // Base fee per signature is 5000 lamports
      medianTotalFee: fees[mid] + 5000,
    };
  }

  return ok({
    timestamp,
    rpc: {
      epoch,
      validators,
      tps,
      inflation,
      supply,
      clusterNodes,
      medianFee,
      endpoint: epochRes.ok ? epochRes.endpoint : "unavailable",
    },
    stablecoins: stablecoinData,
    dexVolume: dexVolumeData,
    feesRevenue: feesData,
    rwaProtocols: rwaData,
    upcomingUpgrades: [
      {
        name: "Alpenglow",
        description:
          "Consensus upgrade introducing BFT voting and Votor to reduce finality times from ~12s to ~100ms.",
        status: "In development",
        simd: "SIMD-220",
      },
      {
        name: "SIMD-525",
        description:
          "Real Economic Value (REV) metric standardization — defines fee economics and validator revenue reporting.",
        status: "Proposed",
        simd: "SIMD-525",
      },
      {
        name: "SIMD-228",
        description:
          "Token Extensions — non-transferable positions, transfer hooks, metadata extensions for compliant assets.",
        status: "Active",
        simd: "SIMD-228",
      },
    ],
    sources: {
      rpc: "Solana mainnet (multi-endpoint fallback)",
      stablecoins: "DeFiLlama",
      dexVolume: "DeFiLlama",
      feesRevenue: "DeFiLlama",
      rwaProtocols: "DeFiLlama",
      upcomingUpgrades: "Solana documentation (static)",
    },
  });
}

interface Validator {
  votePubkey: string;
  activatedStake: number;
  commission: number;
  lastVote: number;
  epochVoteAccount: boolean;
}

// ── DeFiLlama helpers ──

async function fetchStablecoinSupply(): Promise<{
  totalSupply: number;
  byToken: Array<{ name: string; symbol: string; supply: number }>;
  history: Array<{ date: number; total: number }>;
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://stablecoins.llama.fi/stablecoincharts/Solana", {
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data: Array<{
      date: number;
      totalCirculatingUSD?: { peggedUSD?: number } | Record<string, number>;
    }> = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const latest = data[data.length - 1];
    const totalSupply = latest.totalCirculatingUSD?.peggedUSD ?? 0;
    // Get last 30 days of history
    const history = data.slice(-30).map((d) => ({
      date: d.date,
      total: d.totalCirculatingUSD?.peggedUSD ?? 0,
    }));
    return { totalSupply, byToken: [], history };
  } catch {
    return null;
  }
}

async function fetchDexVolume(): Promise<{
  total24h: number;
  total7d: number;
  total30d: number;
  protocols: Array<{ name: string; volume24h: number }>;
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.llama.fi/overview/dexs/Solana", {
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = {
      total24h: 0,
      total7d: 0,
      total30d: 0,
      protocols: [] as Array<Record<string, unknown>>,
    } as Record<string, unknown>;
    const json = (await res.json()) as Record<string, unknown>;
    const total24h = Number(json["total24h"]) || 0;
    const total7d = Number(json["total7d"]) || 0;
    const total30d = Number(json["total30d"]) || 0;
    const protos = (json["protocols"] as Array<Record<string, unknown>>) || [];
    const protocols = protos
      .filter((p) => (Number(p["total24h"]) || 0) > 0)
      .sort((a, b) => (Number(b["total24h"]) || 0) - (Number(a["total24h"]) || 0))
      .slice(0, 20)
      .map((p) => ({ name: String(p["name"] || ""), volume24h: Number(p["total24h"]) || 0 }));
    return { total24h, total7d, total30d, protocols };
  } catch {
    return null;
  }
}

async function fetchFeesRevenue(): Promise<{
  total24hFees: number;
  total7dFees: number;
  total30dFees: number;
  protocols: Array<{ name: string; fees24h: number }>;
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.llama.fi/overview/fees/Solana", {
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const total24hFees = Number(json["total24h"]) || 0;
    const total7dFees = Number(json["total7d"]) || 0;
    const total30dFees = Number(json["total30d"]) || 0;
    const protos = (json["protocols"] as Array<Record<string, unknown>>) || [];
    const protocols = protos
      .filter((p) => (Number(p["total24h"]) || 0) > 0)
      .sort((a, b) => (Number(b["total24h"]) || 0) - (Number(a["total24h"]) || 0))
      .slice(0, 20)
      .map((p) => ({ name: String(p["name"] || ""), fees24h: Number(p["total24h"]) || 0 }));
    return { total24hFees, total7dFees, total30dFees, protocols };
  } catch {
    return null;
  }
}

async function fetchRwaProtocols(): Promise<Array<{
  name: string;
  tvl: number;
  category: string;
}> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.llama.fi/protocols", {
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data: Array<Record<string, unknown>> = await res.json();
    const rwa = data
      .filter((p) => p["chain"] === "Solana" && String(p["category"] || "").toLowerCase() === "rwa")
      .map((p) => ({
        name: String(p["name"] || ""),
        tvl: Number(p["tvl"]) || 0,
        category: String(p["category"] || "RWA"),
      }))
      .sort((a, b) => b.tvl - a.tvl);
    return rwa;
  } catch {
    return null;
  }
}
