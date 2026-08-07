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
   * Fetch raw protocols from DeFiLlama.
   *
   * Returns raw protocol data wrapped as RawProject for consistency
   * with the provider interface.
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

    const protocols = response.data;

    // Map to RawProject (minimal: id, name, category, description)
    const projects: RawProject[] = protocols.map((proto) => ({
      id: `defillama-${proto.id}`,
      name: proto.name,
      category: proto.category ?? "defi",
      description: `DeFi protocol on ${proto.chains?.join(", ") ?? "unknown chain"} — TVL: $${(proto.tvl ?? 0).toLocaleString()}`,
    }));

    return { data: projects, asOf: new Date().toISOString() };
  }

  /** Stub — evidence ingestion not in scope for this milestone. */
  async fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    return Promise.resolve({ data: [], asOf: new Date().toISOString() });
  }

  /** Stub — narrative ingestion not in scope for this milestone. */
  async fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return Promise.resolve({ data: [], asOf: new Date().toISOString() });
  }
}
