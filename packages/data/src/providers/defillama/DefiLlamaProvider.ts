import type {
  ProviderFetch,
  ProviderHealth,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../../interfaces/DataProvider";
import type { EntityClassification } from "@insight/core";
import { BaseProvider } from "../base/BaseProvider";
import type { BaseProviderOptions } from "../base/BaseProvider";

/**
 * DefiLlamaProvider — a DeFiLlama-backed {@link import("../../interfaces/DataProvider").DataProvider}.
 *
 * Fetches raw DeFi protocol data via DeFiLlama public API. Returns RAW data only —
 * no mapping to core types, no scoring, no business logic. Transformers
 * handle raw → core conversion.
 */

/** Raw protocol data from DeFiLlama /protocols endpoint. */
export interface RawDefiLlamaProtocol {
  id: string;
  name: string;
  symbol?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  chainTvls?: Record<string, number>;
  module?: string;
  twitter?: string;
  auditLinks?: string[];
  listedAt?: number;
  methodology?: string;
  governanceId?: string;
  forkedFrom?: string[];
  parentProtocol?: string;
  oracles?: string[];
  chain?: string;
  logo?: string;
  url?: string;
  github?: string;
  parentProtocolId?: string;
}

/** Config for DeFiLlama provider. */
export interface DefiLlamaConfig {
  /** DeFiLlama API base URL. Defaults to public API. */
  apiUrl?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

const DEFAULT_API_URL = "https://api.llama.fi";

/**
 * DeFiLlama category → Insight Solana taxonomy mapping.
 * Most DeFiLlama protocols are DeFi, so the default fallback is "defi".
 */
const CATEGORY_MAP: Record<string, string> = {
  // DEX
  Dexes: "dex",
  Dex: "dex",
  AMM: "dex",
  // Lending
  Lending: "lending",
  Borrowing: "lending",
  CDP: "lending",
  // Yield
  Yield: "yield",
  "Yield Aggregator": "yield",
  // Liquid Staking
  "Liquid Staking": "liquid-staking",
  Staking: "liquid-staking",
  // Bridge
  Bridge: "bridge",
  "Cross Chain": "bridge",
  // Derivatives
  Derivatives: "derivatives",
  Perps: "derivatives",
  Options: "derivatives",
  // Payments
  Payments: "payments",
  // NFT
  "NFT Marketplace": "nft",
  NFT: "nft",
  // Oracle
  Oracle: "oracle",
  // RWA
  RWA: "rwa",
  Tokenized: "rwa",
  // Gaming
  Gaming: "gaming",
  // Social
  Social: "social",
  // Wallet
  Wallet: "wallets",
  // Infrastructure
  Infrastructure: "infrastructure",
  RPC: "infrastructure",
  "RPC Node": "infrastructure",
  // AI
  AI: "ai",
  // DePIN
  DePIN: "depin",
  // Stablecoin
  Stablecoin: "stablecoins",
  // Restaking
  Restaking: "restaking",
  "Liquid Restaking": "restaking",
  // MEV
  MEV: "mev",
  // Validator
  Validator: "validators",
  // Data
  Data: "data",
  // Security
  Security: "security",
  // Developer Tooling
  "Developer Tooling": "developer-tools",
  "Dev Tooling": "developer-tools",
};

/**
 * CEX names that represent market context rather than Solana ecosystem projects.
 * These get `classification: "market_context"` instead of the default
 * `classification: "solana_ecosystem"`.
 */
const CEX_NAMES: ReadonlySet<string> = new Set([
  "Binance",
  "Bybit",
  "OKX",
  "Bitfinex",
  "Gate",
  "MEXC",
  "Bitget",
  "Deribit",
  "HTX",
  "Coinbase",
  "Kraken",
  "Kucoin",
  "Bingx",
  "Poloniex",
  "Bitrue",
  "Crypto.com",
  "Upbit",
  "WazirX",
  "Bitmart",
  "Bitmex",
  "Coinex",
  "Hotbit",
  "Okx",
]);

/** Map a DeFiLlama category string to the Insight taxonomy. Defaults to "defi". */
function mapCategory(defillamaCategory: string | undefined): string {
  if (defillamaCategory === undefined) {
    return "defi";
  }
  return CATEGORY_MAP[defillamaCategory] ?? "defi";
}

/** Determine entity classification for a protocol. */
function classifyEntity(id: string, name: string): EntityClassification {
  const normName = name.toLowerCase();

  // The Solana chain entry itself is a network, not a project.
  if (id === "solana" || normName === "solana") {
    return "network";
  }
  // Centralized exchanges are market context, not ecosystem projects.
  // Use case-insensitive substring matching so "Binance CEX" matches "Binance".
  for (const cex of CEX_NAMES) {
    if (normName.includes(cex.toLowerCase())) {
      return "market_context";
    }
  }
  return "solana_ecosystem";
}

export class DefiLlamaProvider extends BaseProvider {
  private readonly apiUrl: string;
  private readonly timeout: number;

  constructor(config: DefiLlamaConfig = {}, options: Omit<BaseProviderOptions, "id" | "name">) {
    super({
      ...options,
      id: "defillama",
      name: "DeFiLlama",
    });
    this.apiUrl = config.apiUrl ?? DEFAULT_API_URL;
    this.timeout = config.timeout ?? 10_000;
  }

  private buildUrl(path: string): string {
    return `${this.apiUrl}${path}`;
  }

  protected async checkHealth(): Promise<boolean> {
    try {
      this.acquire();
      const response = await this.httpClient.get<unknown>({
        url: this.buildUrl("/protocols"),
        timeoutMs: this.timeout,
      });
      return response.ok && Array.isArray(response.data);
    } catch {
      return false;
    }
  }

  /**
   * Fetch raw protocols from DeFiLlama — filtered to Solana-chain protocols.
   *
   * Populates structured metrics (tvl, volume24h) and evidence references
   * so the pipeline can surface real TVL data in dashboards, comparisons,
   * and health scores.
   */
  async fetchProjects(): Promise<ProviderFetch<RawProject>> {
    this.acquire();

    const response = await this.httpClient.get<RawDefiLlamaProtocol[]>({
      url: this.buildUrl("/protocols"),
      timeoutMs: this.timeout,
    });

    if (!response.ok || !Array.isArray(response.data)) {
      return { data: [], asOf: new Date().toISOString() };
    }

    const allProtocols = response.data;
    const asOf = new Date().toISOString();

    // Filter to protocols present on Solana
    const solanaProtocols = allProtocols.filter((p) => p.chains?.includes("Solana") ?? false);

    // Map to RawProject with structured metrics and rich category mapping
    const projects: RawProject[] = solanaProtocols.map((proto) => {
      const solanaTvl = proto.chainTvls?.["Solana"] ?? proto.tvl ?? 0;
      const evidenceId = `defillama-${proto.id}-tvl`;
      const category = mapCategory(proto.category);
      const classification = classifyEntity(proto.id, proto.name);
      return {
        id: `defillama-${proto.id}`,
        name: proto.name,
        category,
        description: `DeFi protocol on Solana — TVL: $${solanaTvl.toLocaleString()}`,
        metrics: {
          tvl: solanaTvl,
          volume24h: proto.change24h ? solanaTvl * (proto.change24h / 100) : undefined,
        },
        evidenceIds: [evidenceId],
        updatedAt: asOf,
        classification,
        logoUrl: proto.logo,
        slug: proto.module ?? proto.id.toString(),
        symbol: proto.symbol,
        change24h: proto.change24h,
        change7d: proto.change7d,
        change30d: proto.change30d,
        website: proto.url,
        twitter: proto.twitter,
        github: proto.github,
      };
    });

    return { data: projects, asOf };
  }

  /**
   * Fetch evidence items — TVL evidence for each Solana protocol.
   * Each evidence item records the source (DeFiLlama), the TVL value,
   * and 24h/7d/30d change percentages for traceability.
   */
  async fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    this.acquire();

    const response = await this.httpClient.get<RawDefiLlamaProtocol[]>({
      url: this.buildUrl("/protocols"),
      timeoutMs: this.timeout,
    });

    if (!response.ok || !Array.isArray(response.data)) {
      return { data: [], asOf: new Date().toISOString() };
    }

    const asOf = new Date().toISOString();
    const solanaProtocols = response.data.filter((p) => p.chains?.includes("Solana") ?? false);

    const evidence: RawEvidence[] = solanaProtocols.map((proto) => {
      const solanaTvl = proto.chainTvls?.["Solana"] ?? proto.tvl ?? 0;
      const parts: string[] = [`TVL: $${solanaTvl.toLocaleString()}`];
      if (proto.change24h !== undefined) parts.push(`24h: ${proto.change24h.toFixed(1)}%`);
      if (proto.change7d !== undefined) parts.push(`7d: ${proto.change7d.toFixed(1)}%`);
      if (proto.change30d !== undefined) parts.push(`30d: ${proto.change30d.toFixed(1)}%`);

      return {
        id: `defillama-${proto.id}-tvl`,
        sourceId: "defillama",
        sourceName: "DeFiLlama",
        note: `${proto.name} — ${parts.join(", ")}`,
        status: "verified",
        observedAt: asOf,
        reference: `https://defillama.com/protocol/${proto.id}`,
      };
    });

    return { data: evidence, asOf };
  }

  /** Stub — narrative ingestion not in scope for this milestone. */
  async fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return Promise.resolve({ data: [], asOf: new Date().toISOString() });
  }
}
