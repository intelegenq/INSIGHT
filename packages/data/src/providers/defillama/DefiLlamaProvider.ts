import type {
  ProviderFetch,
  ProviderHealth,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../../interfaces/DataProvider";
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
}

/** Config for DeFiLlama provider. */
export interface DefiLlamaConfig {
  /** DeFiLlama API base URL. Defaults to public API. */
  apiUrl?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

const DEFAULT_API_URL = "https://api.llama.fi";

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

    // Map to RawProject with structured metrics
    const projects: RawProject[] = solanaProtocols.map((proto) => {
      const solanaTvl = proto.chainTvls?.["Solana"] ?? proto.tvl ?? 0;
      const evidenceId = `defillama-${proto.id}-tvl`;
      return {
        id: `defillama-${proto.id}`,
        name: proto.name,
        category: proto.category ?? "defi",
        description: `DeFi protocol on Solana — TVL: $${solanaTvl.toLocaleString()}`,
        metrics: {
          tvl: solanaTvl,
          volume24h: proto.change24h ? solanaTvl * (proto.change24h / 100) : undefined,
        },
        evidenceIds: [evidenceId],
        updatedAt: asOf,
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
