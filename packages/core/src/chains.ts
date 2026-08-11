/**
 * @insight/core/chains — multi-chain contracts (M28).
 *
 * A chain is an optional, additive dimension on Evidence/Project/Source.
 * Solana remains the default and primary chain: when no chain is present on
 * a record, `chainOf` resolves to SOLANA so existing Solana behaviour and
 * demo data are unchanged.
 *
 * Chain-aware identity: `evidenceKey` namespaces an evidence id by chain so
 * the same logical record on different chains does not collide (dedup).
 */

/** Stable machine-readable chain identifier. */
export type ChainId = "solana" | "ethereum" | string;

/** Human-facing chain metadata. */
export interface ChainInfo {
  id: ChainId;
  name: string;
  /** Native asset symbol. */
  symbol: string;
}

/** Default / primary chain. */
export const SOLANA: ChainInfo = { id: "solana", name: "Solana", symbol: "SOL" };
/** Secondary chain (added only where existing contracts support it cleanly). */
export const ETHEREUM: ChainInfo = { id: "ethereum", name: "Ethereum", symbol: "ETH" };

/** Chain registry for UI labels. */
export const CHAINS: readonly ChainInfo[] = [SOLANA, ETHEREUM];

/** The default chain applied when a record carries no chain. */
export const DEFAULT_CHAIN: ChainId = SOLANA.id;

/**
 * Resolve the chain for a record from its optional chain field or a
 * reference URL/URN. Defaults to Solana to preserve existing behaviour.
 */
export function chainOf(record?: { chain?: ChainId; reference?: string }): ChainId {
  if (record?.chain !== undefined && record.chain !== "") {
    return record.chain;
  }
  const ref = record?.reference;
  if (typeof ref === "string") {
    const lower = ref.toLowerCase();
    if (lower.includes("ethereum") || lower.includes("etherscan") || lower.startsWith("eip155:1")) {
      return ETHEREUM.id;
    }
    if (lower.includes("solana") || lower.includes("solscan")) {
      return SOLANA.id;
    }
  }
  return DEFAULT_CHAIN;
}

/**
 * Chain-aware identity key for an evidence record: `<chain>:<id>`.
 * Two records with the same id on different chains are distinct.
 */
export function evidenceKey(evidence: { id: string; chain?: ChainId; reference?: string }): string {
  return `${chainOf(evidence)}:${evidence.id}`;
}

/** True when two records resolve to the same chain. */
export function sameChain(
  a: { chain?: ChainId; reference?: string },
  b: { chain?: ChainId; reference?: string },
): boolean {
  return chainOf(a) === chainOf(b);
}

/**
 * Chain-aware dedup: returns one record per `evidenceKey`, keeping the
 * first occurrence. Deterministic and order-preserving.
 */
export function dedupeByChain<T extends { id: string; chain?: ChainId; reference?: string }>(
  records: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const record of records) {
    const key = evidenceKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

/** Display metadata for a chain id (falls back to a generic label). */
export function chainInfo(id: ChainId): ChainInfo {
  return CHAINS.find((c) => c.id === id) ?? { id, name: id, symbol: id.toUpperCase() };
}
