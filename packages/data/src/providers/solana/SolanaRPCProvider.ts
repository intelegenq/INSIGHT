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
 * SolanaRPCProvider — a Solana RPC-backed {@link import("../../interfaces/DataProvider").DataProvider}.
 *
 * Fetches raw Solana on-chain data via JSON-RPC. Returns RAW data only —
 * no mapping to core types, no scoring, no business logic. Transformers
 * handle raw → core conversion.
 */

/** Raw Solana account info from getAccountInfo. */
export interface RawSolanaAccount {
  address: string;
  lamports: number;
  owner: string;
  executable: boolean;
  rentEpoch: number;
  data: string | { parsed: unknown; program: string; space: number };
}

/** Raw program data from getProgramAccounts. */
export interface RawProgramData {
  pubkey: string;
  account: RawSolanaAccount;
}

/** Config for Solana RPC provider. */
export interface SolanaRPCConfig {
  /** Solana RPC endpoint URL. */
  rpcUrl: string;
  /** Optional: commitment level. Defaults to "confirmed". */
  commitment?: "processed" | "confirmed" | "finalized";
}

const DEFAULT_COMMITMENT = "confirmed" as const;

/** JSON-RPC 2.0 request envelope. */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown[];
}

/** JSON-RPC 2.0 response envelope. */
interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

/** getHealth response. */
interface HealthResult {
  status: "ok" | "unhealthy";
}

/** getAccountInfo result. */
interface AccountInfoResult {
  context: { slot: number };
  value: RawSolanaAccount | null;
}

/** getProgramAccounts result. */
interface ProgramAccountsResult {
  context: { slot: number };
  value: Array<{ pubkey: string; account: RawSolanaAccount }>;
}

/** getTokenAccountsByOwner result. */
interface TokenAccountsResult {
  context: { slot: number };
  value: Array<{ pubkey: string; account: RawSolanaAccount }>;
}

export class SolanaRPCProvider extends BaseProvider {
  private readonly rpcUrl: string;
  private readonly commitment: "processed" | "confirmed" | "finalized";
  private requestId = 0;

  constructor(config: SolanaRPCConfig, options: Omit<BaseProviderOptions, "id" | "name">) {
    super({
      ...options,
      id: "solana-rpc",
      name: "Solana RPC",
    });
    this.rpcUrl = config.rpcUrl;
    this.commitment = config.commitment ?? DEFAULT_COMMITMENT;
  }

  /** Build a JSON-RPC request. */
  private buildRequest(method: string, params: unknown[] = []): JsonRpcRequest {
    return {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method,
      params,
    };
  }

  /** Execute a JSON-RPC call. */
  private async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const response = await this.httpClient.post<JsonRpcResponse<T>>({
      url: this.rpcUrl,
      body: this.buildRequest(method, params),
    });

    if (!response.ok || response.data === null) {
      throw new Error(`RPC ${method} failed: ${response.status}`);
    }

    const rpcResponse = response.data;
    if (rpcResponse.error) {
      throw new Error(`RPC ${method} error: ${rpcResponse.error.message}`);
    }

    return rpcResponse.result as T;
  }

  protected async checkHealth(): Promise<boolean> {
    try {
      this.acquire();
      const result = await this.rpcCall<HealthResult>("getHealth");
      return result.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Fetch raw program accounts — primary "project" data source.
   *
   * Returns raw accounts for the configured program IDs. Subclass or config
   * can extend which programs to fetch. For now, fetch a few major programs
   * as a starting point.
   */
  async fetchProjects(): Promise<ProviderFetch<RawProject>> {
    this.acquire();

    // Default to fetching a few well-known program accounts as raw data
    const programIds = [
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token 2022
      "11111111111111111111111111111111", // System Program
    ];

    const allAccounts: RawProgramData[] = [];

    for (const programId of programIds) {
      try {
        const result = await this.rpcCall<ProgramAccountsResult>("getProgramAccounts", [
          programId,
          { encoding: "jsonParsed", commitment: this.commitment, withContext: true },
        ]);

        const accounts = result.value ?? [];
        for (const acc of accounts) {
          allAccounts.push({
            pubkey: acc.pubkey,
            account: acc.account,
          });
        }
      } catch {
        // Continue on individual program fetch failure
      }
    }

    // Wrap as RawProject (minimal: id + name + category + description)
    const projects: RawProject[] = allAccounts.map((acc, idx) => ({
      id: `solana-${acc.pubkey}`,
      name: `Account ${acc.pubkey.slice(0, 8)}…`,
      category: "solana-account",
      description: `Raw Solana account owned by ${acc.account.owner}`,
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
