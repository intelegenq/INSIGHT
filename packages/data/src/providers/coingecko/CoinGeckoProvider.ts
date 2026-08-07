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
 * CoinGeckoProvider — a CoinGecko-backed {@link import("../../interfaces/DataProvider").DataProvider}.
 *
 * Fetches raw market data via CoinGecko public API. Returns RAW data only —
 * no mapping to core types, no scoring, no business logic. Transformers
 * handle raw → core conversion.
 */

/** Raw market asset data from CoinGecko /coins/markets endpoint. */
export interface RawCoinGeckoMarketAsset {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  market_cap: number;
  market_cap_rank?: number;
  fully_diluted_valuation?: number;
  total_volume: number;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  ath?: number;
  ath_change_percentage?: number;
  ath_date?: string;
  atl?: number;
  atl_change_percentage?: number;
  atl_date?: string;
  last_updated: string;
}

/** Config for CoinGecko provider. */
export interface CoinGeckoConfig {
  /** CoinGecko API base URL. Defaults to public API. */
  apiUrl?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

const DEFAULT_API_URL = "https://api.coingecko.com/api/v3";

export class CoinGeckoProvider extends BaseProvider {
  private readonly apiUrl: string;
  private readonly timeout: number;

  constructor(config: CoinGeckoConfig = {}, options: Omit<BaseProviderOptions, "id" | "name">) {
    super({
      ...options,
      id: "coingecko",
      name: "CoinGecko",
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
      const response = await this.httpClient.get<{ gecko_says: string }>({
        url: this.buildUrl("/ping"),
        timeoutMs: this.timeout,
      });
      return response.ok && response.data?.gecko_says === "(V3) To the Moon!";
    } catch {
      return false;
    }
  }

  /**
   * Fetch raw market data from CoinGecko.
   *
   * Returns raw market assets wrapped as RawProject for consistency
   * with the provider interface. Wrapped in withRetry so transient
   * HTTP failures recover automatically within the configured policy.
   */
  async fetchProjects(): Promise<ProviderFetch<RawProject>> {
    this.acquire();

    const response = await this.withRetry(() =>
      this.httpClient.get<RawCoinGeckoMarketAsset[]>({
        url: this.buildUrl("/coins/markets"),
        query: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: "100",
          page: "1",
          sparkline: "false",
          price_change_percentage: "24h",
        },
        timeoutMs: this.timeout,
      }),
    );

    if (!response.ok || !Array.isArray(response.data)) {
      return { data: [], asOf: new Date().toISOString() };
    }

    const assets = response.data;

    // Map to RawProject (minimal: id, name, category, description)
    const projects: RawProject[] = assets.map((asset) => ({
      id: `coingecko-${asset.id}`,
      name: asset.name,
      category: "market-asset",
      description: `${asset.symbol.toUpperCase()} — $${asset.current_price?.toLocaleString() ?? "N/A"} | Market Cap: $${asset.market_cap?.toLocaleString() ?? "N/A"} | 24h Change: ${asset.price_change_percentage_24h?.toFixed(2) ?? "N/A"}%`,
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
