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
 * HeliusProvider — a Helius-backed {@link import("../../interfaces/DataProvider").DataProvider}.
 *
 * Milestone scope: infrastructure only. Implements `health()` and
 * `fetchProjects()` against the Helius API through {@link HttpClient};
 * `fetchEvidence()` and `fetchNarratives()` are stubs for future expansion.
 *
 * This provider returns RAW data only — it never maps to core types, scores,
 * or builds narratives. That is the transformer layer's job.
 */

/** Config required to talk to Helius. */
export interface HeliusConfig {
  /** Helius API key. */
  apiKey: string;
  /** Cluster identifier (e.g. "mainnet-beta"); defaults to mainnet. */
  cluster?: string;
}

const DEFAULT_CLUSTER = "mainnet-beta";

/** Helius RPC response shape for getTokenAccounts (parsed) — raw, minimal. */
interface HeliusRpcResponse<T> {
  jsonrpc: string;
  result: T;
}

export class HeliusProvider extends BaseProvider {
  private readonly apiKey: string;
  private readonly cluster: string;

  constructor(config: HeliusConfig, options: Omit<BaseProviderOptions, "id" | "name">) {
    super({
      ...options,
      id: "helius",
      name: "Helius",
    });
    this.apiKey = config.apiKey;
    this.cluster = config.cluster ?? DEFAULT_CLUSTER;
  }

  /** Build a Helius RPC URL for the configured cluster. */
  private rpcUrl(): string {
    return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(this.apiKey)}`;
  }

  protected async checkHealth(): Promise<boolean> {
    try {
      this.acquire();
      const response = await this.httpClient.post<HeliusRpcResponse<unknown>>({
        url: this.rpcUrl(),
        body: { jsonrpc: "2.0", id: 1, method: "getHealth" },
      });
      return response.ok && response.data !== null;
    } catch {
      return false;
    }
  }

  /** Fetch raw projects (token accounts) from Helius. */
  async fetchProjects(): Promise<ProviderFetch<RawProject>> {
    this.acquire();
    const response = await this.httpClient.post<HeliusRpcResponse<unknown>>({
      url: this.rpcUrl(),
      body: { jsonrpc: "2.0", id: 2, method: "getTokenAccounts" },
    });
    const raw = extractRecords(response.data);
    return { data: raw, asOf: "1970-01-01T00:00:00.000Z" };
  }

  /** Stub — Helius evidence ingestion is not part of this milestone. */
  async fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    return Promise.resolve({ data: [], asOf: "1970-01-01T00:00:00.000Z" });
  }

  /** Stub — Helius narrative ingestion is not part of this milestone. */
  async fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return Promise.resolve({ data: [], asOf: "1970-01-01T00:00:00.000Z" });
  }
}

/** Extract raw project records from a Helius RPC result (no mapping to core). */
function extractRecords(result: unknown): RawProject[] {
  const rpc = result as { result?: string } | null;
  const parsed = rpc?.result ?? null;
  if (typeof parsed !== "string") {
    return [];
  }
  return [
    {
      id: `helius-${parsed.substring(0, 16)}`,
      name: "Helius placeholder project",
      category: "other",
      description: "Raw Helius placeholder record (infrastructure milestone).",
    },
  ];
}

export type { ProviderHealth };
