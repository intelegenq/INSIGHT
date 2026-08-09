/**
 * ProductionProviders — M29 environment-backed provider wiring.
 *
 * Reads API keys and RPC endpoints from a process.env-like record and
 * constructs live {@link DataProvider} instances backed by real HTTP
 * transports. When a credential is absent, that provider is skipped so
 * the pipeline degrades gracefully to demo data rather than failing.
 *
 * Tests inject a fake env + MockHttpClient to verify wiring without
 * touching the network — production supplies real credentials via env.
 */
import { HttpClient, fetchTransport } from "./base/HttpClient";
import type { HttpTransport } from "./base/HttpClient";
import { HeliusProvider } from "./helius/HeliusProvider";
import type { HeliusConfig } from "./helius/HeliusProvider";
import { SolanaRPCProvider } from "./solana/SolanaRPCProvider";
import type { SolanaRPCConfig } from "./solana/SolanaRPCProvider";
import { DefiLlamaProvider } from "./defillama/DefiLlamaProvider";
import { CoinGeckoProvider } from "./coingecko/CoinGeckoProvider";
import { DemoProvider } from "./DemoProvider";
import type { DataProvider } from "../interfaces/DataProvider";

/** Environment keys consumed by the production provider factory. */
export interface ProviderEnv {
  /** Helius API key — enables the Helius on-chain data provider. */
  HELIUS_API_KEY?: string;
  /** Solana RPC endpoint (e.g. public mainnet or paid RPC). */
  SOLANA_RPC_URL?: string;
  /** Override DeFiLlama API base URL (defaults to public API). */
  DEFILLAMA_API_URL?: string;
  /** Override CoinGecko API base URL (defaults to public API). */
  COINGECKO_API_URL?: string;
  /** When "demo", no live providers are registered — demo only. */
  NEXT_PUBLIC_INSIGHT_DATA_MODE?: string;
}

/** Transport factory — overridable in tests. */
export type TransportFactory = () => HttpTransport;

export interface ProductionProviderConfig {
  /** Environment-like record (defaults to process.env). */
  env?: Record<string, string | undefined>;
  /** HTTP transport factory (defaults to real fetch). */
  transport?: TransportFactory;
}

/**
 * Resolve which live providers are available from env credentials.
 * Returns an ordered array — first live providers, then the demo
 * provider as a fallback so the pipeline always has data.
 */
export function resolveProductionProviders(config: ProductionProviderConfig = {}): DataProvider[] {
  const env = config.env ?? process.env;
  const transport = config.transport ?? fetchTransport;
  const httpClient = new HttpClient({}, transport());

  const providers: DataProvider[] = [];

  // Skip live providers entirely in demo mode
  if (env["NEXT_PUBLIC_INSIGHT_DATA_MODE"] === "demo") {
    return [new DemoProvider()];
  }

  // Helius — requires API key
  const heliusKey = env["HELIUS_API_KEY"];
  if (heliusKey && heliusKey.length > 0) {
    providers.push(
      new HeliusProvider({ apiKey: heliusKey } satisfies HeliusConfig, { httpClient }),
    );
  }

  // Solana RPC — requires endpoint URL
  const solanaUrl = env["SOLANA_RPC_URL"];
  if (solanaUrl && solanaUrl.length > 0) {
    providers.push(
      new SolanaRPCProvider({ rpcUrl: solanaUrl } satisfies SolanaRPCConfig, { httpClient }),
    );
  }

  // DeFiLlama — public API, always available (unless overridden off)
  const defillamaUrl = env["DEFILLAMA_API_URL"];
  providers.push(
    new DefiLlamaProvider(defillamaUrl ? { apiUrl: defillamaUrl } : {}, { httpClient }),
  );

  // CoinGecko — public API, always available
  const coingeckoUrl = env["COINGECKO_API_URL"];
  providers.push(
    new CoinGeckoProvider(coingeckoUrl ? { apiUrl: coingeckoUrl } : {}, { httpClient }),
  );

  // Always include demo as fallback so the pipeline has baseline data
  providers.push(new DemoProvider());

  return providers;
}

/** Check whether any live (non-demo) provider is configured. */
export function hasLiveProviders(env: Record<string, string | undefined> = process.env): boolean {
  if (env["NEXT_PUBLIC_INSIGHT_DATA_MODE"] === "demo") return false;
  return Boolean(
    env["HELIUS_API_KEY"] ||
    env["SOLANA_RPC_URL"] ||
    env["DEFILLAMA_API_URL"] ||
    env["COINGECKO_API_URL"],
  );
}
