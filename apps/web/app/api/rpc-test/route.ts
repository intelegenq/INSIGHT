import { ok } from "../../../lib/api";

/**
 * GET /api/rpc-test — test Solana RPC connectivity from Vercel.
 */
export async function GET(): Promise<Response> {
  const endpoints = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
    "https://solana-mainnet.g.alchemy.com/v2/demo",
  ];

  const results: { endpoint: string; ok: boolean; data?: unknown; error?: string }[] = [];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getEpochInfo",
          params: [{ commitment: "confirmed" }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      results.push({
        endpoint: url,
        ok: true,
        data: data?.result
          ? {
              epoch: data.result.epoch,
              slotIndex: data.result.slotIndex,
              slotsInEpoch: data.result.slotsInEpoch,
              blockHeight: data.result.blockHeight,
              transactionCount: data.result.transactionCount,
            }
          : data,
      });
    } catch (err) {
      results.push({
        endpoint: url,
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // Also test getHealth
  const healthResults: { endpoint: string; ok: boolean; status?: string }[] = [];
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      healthResults.push({ endpoint: url, ok: true, status: data?.result });
    } catch (err) {
      healthResults.push({
        endpoint: url,
        ok: false,
        status: err instanceof Error ? err.message : "error",
      });
    }
  }

  return ok({ epochResults: results, healthResults });
}
