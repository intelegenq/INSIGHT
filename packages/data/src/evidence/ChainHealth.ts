import type { ChainId } from "@insight/core";
import { chainOf, DEFAULT_CHAIN } from "@insight/core";
import type { SourceHealthReport, SourceHealthEntry } from "../monitoring/SourceHealthMonitor";

/**
 * ChainHealth — M28 adapter over the canonical SourceHealthMonitor report.
 *
 * Maps each provider to a chain and derives a per-chain health gate:
 * a chain is "enabled" only when every provider feeding it is healthy.
 * Providers without a chain signal resolve to Solana (DEFAULT_CHAIN), so
 * existing Solana behaviour is unchanged. This is an adapter — it does not
 * modify SourceHealthMonitor.
 */

/** Resolve the chain a provider id belongs to (defaults to Solana). */
export function chainForProvider(providerId: string): ChainId {
  const lower = providerId.toLowerCase();
  if (lower.includes("ethereum") || lower.includes("evm") || lower.startsWith("eip155")) {
    return "ethereum";
  }
  if (lower.includes("solana") || lower.includes("helius")) {
    return "solana";
  }
  return DEFAULT_CHAIN;
}

/** Per-chain health gate derived from a source health report. */
export interface ChainHealthGate {
  chain: ChainId;
  /** True when every provider for this chain is available. */
  enabled: boolean;
  /** Provider ids contributing to this chain. */
  providers: string[];
  /** Unhealthy provider ids blocking this chain. */
  unhealthy: string[];
}

/** Derive per-chain health gates from a source health report. */
export function chainHealthGates(
  report: SourceHealthReport,
  resolve: (providerId: string) => ChainId = chainForProvider,
): ChainHealthGate[] {
  const byChain = new Map<ChainId, SourceHealthEntry[]>();
  for (const entry of report.providers) {
    const chain = resolve(entry.id);
    const list = byChain.get(chain) ?? [];
    list.push(entry);
    byChain.set(chain, list);
  }
  return Array.from(byChain.entries()).map(([chain, entries]) => {
    const unhealthy = entries.filter((e) => e.status !== "healthy").map((e) => e.id);
    return {
      chain,
      enabled: unhealthy.length === 0,
      providers: entries.map((e) => e.id),
      unhealthy,
    };
  });
}

/** True when a chain is enabled (all its providers healthy). */
export function isChainEnabled(report: SourceHealthReport, chain: ChainId): boolean {
  const gate = chainHealthGates(report).find((g) => g.chain === chain);
  return gate?.enabled ?? false;
}

/** Re-export chainOf for consumers that resolve chains from evidence. */
export { chainOf };
