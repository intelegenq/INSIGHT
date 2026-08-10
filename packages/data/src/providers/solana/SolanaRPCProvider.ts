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

/** getEpochInfo response. */
interface EpochInfoResult {
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  absoluteSlot: number;
  blockHeight: number;
  transactionCount: number;
}

/** getVoteAccounts response — validator stake/delinquency/commission. */
interface VoteAccountsResult {
  current: VoteAccount[];
  delinquent: VoteAccount[];
}

interface VoteAccount {
  votePubkey: string;
  nodePubkey: string;
  activatedStake: number;
  epochVoteAccount: boolean;
  commission: number;
  lastVote: number;
  rootSlot: number;
  epochCredits: Array<[number, number, number]>;
}

/** getPerformanceSamples response. */
interface PerformanceSamplesResult extends Array<{
  slot: number;
  numTransactions: number;
  numSlots: number;
  samplePeriodSecs: number;
  numNonVoteTransaction: number;
}> {}

/** getInflationRate response. */
interface InflationRateResult {
  total: number;
  validator: number;
  foundation: number;
  epoch: number;
  startSlot: number;
}

/** getClusterNodes response. */
interface ClusterNodesResult extends Array<{
  pubkey: string;
  gossip: string | null;
  tpu: string | null;
  rpc: string | null;
  version: string;
  featureSet: number;
  shredVersion: number | null;
}> {}

/** Raw validator/stake metrics extracted from RPC. */
export interface SolanaNetworkMetrics {
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  absoluteSlot: number;
  blockHeight: number;
  transactionCount: number;
  totalActiveStake: number;
  totalDelinquentStake: number;
  validatorCount: number;
  delinquentValidatorCount: number;
  averageCommission: number;
  inflationTotal: number;
  inflationValidator: number;
  inflationFoundation: number;
  clusterNodeCount: number;
  tps: number;
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
      const response = await this.httpClient.post<JsonRpcResponse<HealthResult>>({
        url: this.rpcUrl,
        body: this.buildRequest("getHealth"),
        timeoutMs: 5000,
      });
      if (!response.ok || response.data === null) return false;
      const rpcResponse = response.data;
      if (rpcResponse.error) return false;
      return rpcResponse.result?.status === "ok";
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

  /**
   * Fetch network-level validator/stake/delinquency/commission/epoch metrics.
   * Calls getEpochInfo, getVoteAccounts, getInflationRate, getClusterNodes,
   * and getPerformanceSamples in parallel — surfaces them as evidence items.
   */
  async fetchNetworkMetrics(): Promise<SolanaNetworkMetrics | undefined> {
    this.acquire();
    try {
      const [epochInfo, voteAccounts, inflationRate, clusterNodes, perfSamples] = await Promise.all(
        [
          this.rpcCall<EpochInfoResult>("getEpochInfo", [{ commitment: this.commitment }]).catch(
            () => undefined,
          ),
          this.rpcCall<VoteAccountsResult>("getVoteAccounts", [
            { commitment: this.commitment },
          ]).catch(() => undefined),
          this.rpcCall<InflationRateResult>("getInflationRate", []).catch(() => undefined),
          this.rpcCall<ClusterNodesResult>("getClusterNodes", []).catch(() => undefined),
          this.rpcCall<PerformanceSamplesResult>("getPerformanceSamples", [10]).catch(
            () => undefined,
          ),
        ],
      );

      const current = voteAccounts?.current ?? [];
      const delinquent = voteAccounts?.delinquent ?? [];
      const totalActiveStake = current.reduce((sum, v) => sum + v.activatedStake, 0);
      const totalDelinquentStake = delinquent.reduce((sum, v) => sum + v.activatedStake, 0);
      const allValidators = [...current, ...delinquent];
      const averageCommission =
        allValidators.length > 0
          ? allValidators.reduce((sum, v) => sum + v.commission, 0) / allValidators.length
          : 0;

      const recentSamples = perfSamples ?? [];
      const tps =
        recentSamples.length > 0
          ? recentSamples.reduce((sum, s) => sum + s.numTransactions, 0) /
            recentSamples.reduce((sum, s) => sum + s.samplePeriodSecs, 0)
          : 0;

      return {
        epoch: epochInfo?.epoch ?? 0,
        slotIndex: epochInfo?.slotIndex ?? 0,
        slotsInEpoch: epochInfo?.slotsInEpoch ?? 0,
        absoluteSlot: epochInfo?.absoluteSlot ?? 0,
        blockHeight: epochInfo?.blockHeight ?? 0,
        transactionCount: epochInfo?.transactionCount ?? 0,
        totalActiveStake,
        totalDelinquentStake,
        validatorCount: current.length,
        delinquentValidatorCount: delinquent.length,
        averageCommission,
        inflationTotal: inflationRate?.total ?? 0,
        inflationValidator: inflationRate?.validator ?? 0,
        inflationFoundation: inflationRate?.foundation ?? 0,
        clusterNodeCount: clusterNodes?.length ?? 0,
        tps,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Fetch evidence items — includes validator/stake/epoch metrics as evidence.
   */
  async fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    this.acquire();
    const asOf = new Date().toISOString();
    const metrics = await this.fetchNetworkMetrics().catch(() => undefined);
    if (!metrics) {
      return { data: [], asOf };
    }

    const evidence: RawEvidence[] = [
      {
        id: `solana-epoch-${metrics.epoch}`,
        sourceId: "solana-rpc",
        sourceName: "Solana RPC",
        note: `Epoch ${metrics.epoch}: slot ${metrics.slotIndex}/${metrics.slotsInEpoch}, block height ${metrics.blockHeight}, ${metrics.transactionCount.toLocaleString()} total transactions`,
        status: "verified",
        observedAt: asOf,
      },
      {
        id: `solana-validators-${metrics.epoch}`,
        sourceId: "solana-rpc",
        sourceName: "Solana RPC",
        note: `${metrics.validatorCount} active validators, ${metrics.delinquentValidatorCount} delinquent. Active stake: ${(metrics.totalActiveStake / 1e9).toFixed(2)} SOL, delinquent stake: ${(metrics.totalDelinquentStake / 1e9).toFixed(2)} SOL. Average commission: ${metrics.averageCommission.toFixed(1)}%`,
        status: "verified",
        observedAt: asOf,
      },
      {
        id: `solana-inflation-${metrics.epoch}`,
        sourceId: "solana-rpc",
        sourceName: "Solana RPC",
        note: `Inflation — total: ${(metrics.inflationTotal * 100).toFixed(2)}%, validator: ${(metrics.inflationValidator * 100).toFixed(2)}%, foundation: ${(metrics.inflationFoundation * 100).toFixed(2)}%`,
        status: "verified",
        observedAt: asOf,
      },
      {
        id: `solana-performance-${metrics.epoch}`,
        sourceId: "solana-rpc",
        sourceName: "Solana RPC",
        note: `${metrics.clusterNodeCount} cluster nodes, ~${metrics.tps.toFixed(0)} TPS (recent samples)`,
        status: "verified",
        observedAt: asOf,
      },
    ];

    return { data: evidence, asOf };
  }

  /** Stub — narrative ingestion not in scope for this milestone. */
  async fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return Promise.resolve({ data: [], asOf: new Date().toISOString() });
  }
}
