import type { EvidenceItem, EvidenceSource, NormalizeResult } from "./EvidenceTypes";
import type { RawProject } from "../interfaces/DataProvider";
import type { RawCoinGeckoMarketAsset } from "../providers/coingecko/CoinGeckoProvider";
import type { RawDefiLlamaProtocol } from "../providers/defillama/DefiLlamaProvider";
import type { RawSolanaAccount, RawProgramData } from "../providers/solana/SolanaRPCProvider";

/**
 * EvidenceNormalizer — transforms raw provider data into normalized EvidenceItem.
 *
 * Responsibilities:
 * - Convert provider-specific raw types to common EvidenceItem shape
 * - Extract meaningful metadata for cross-provider correlation
 * - No scoring, ranking, or interpretation
 *
 * Each normalize method handles one provider's raw output.
 */
export class EvidenceNormalizer {
  /**
   * Normalize CoinGecko market assets to evidence items.
   */
  normalizeCoinGecko(assets: RawCoinGeckoMarketAsset[] | null | undefined): NormalizeResult {
    if (!Array.isArray(assets)) {
      return { success: true, items: [] };
    }

    const items: EvidenceItem[] = [];

    for (const asset of assets) {
      const source: EvidenceSource = {
        id: `coingecko-${asset.id}`,
        provider: "coingecko",
        timestamp: Date.now(),
        endpoint: "/coins/markets",
        requestParams: { vs_currency: "usd" },
      };

      items.push({
        id: `coingecko-${asset.id}`,
        type: "market-movement",
        source,
        data: {
          symbol: asset.symbol.toUpperCase(),
          name: asset.name,
          price: asset.current_price,
          marketCap: asset.market_cap,
          volume24h: asset.total_volume,
          priceChange24hPct: asset.price_change_percentage_24h,
          marketCapRank: asset.market_cap_rank,
          lastUpdated: asset.last_updated,
        },
        description: `${asset.name} (${asset.symbol.toUpperCase()}) — $${asset.current_price?.toLocaleString() ?? "N/A"} | 24h: ${asset.price_change_percentage_24h?.toFixed(2) ?? "N/A"}%`,
      });
    }

    return { success: true, items };
  }

  /**
   * Normalize DeFiLlama protocols to evidence items.
   */
  normalizeDeFiLlama(protocols: RawDefiLlamaProtocol[] | null | undefined): NormalizeResult {
    if (!Array.isArray(protocols)) {
      return { success: true, items: [] };
    }

    const items: EvidenceItem[] = [];

    for (const proto of protocols) {
      const source: EvidenceSource = {
        id: `defillama-${proto.id}`,
        provider: "defillama",
        timestamp: Date.now(),
        endpoint: "/protocols",
      };

      items.push({
        id: `defillama-${proto.id}`,
        type: "protocol-tvl",
        source,
        data: {
          name: proto.name,
          symbol: proto.symbol,
          category: proto.category,
          chains: proto.chains ?? [],
          tvl: proto.tvl,
          change24h: proto.change24h,
          change7d: proto.change7d,
          change30d: proto.change30d,
          chainTvls: proto.chainTvls ?? {},
          module: proto.module,
          governanceId: proto.governanceId,
          methodology: proto.methodology,
        },
        description: `${proto.name} — TVL: $${proto.tvl?.toLocaleString() ?? "N/A"} | 24h: ${proto.change24h?.toFixed(2) ?? "N/A"}%`,
      });
    }

    return { success: true, items };
  }

  /**
   * Normalize Solana RPC accounts to evidence items.
   */
  normalizeSolana(accounts: RawProgramData[] | null | undefined): NormalizeResult {
    if (!Array.isArray(accounts)) {
      return { success: true, items: [] };
    }

    const items: EvidenceItem[] = [];

    for (const acc of accounts) {
      const source: EvidenceSource = {
        id: `solana-rpc-${acc.pubkey}`,
        provider: "solana-rpc",
        timestamp: Date.now(),
        endpoint: "getProgramAccounts",
      };

      items.push({
        id: `solana-rpc-${acc.pubkey}`,
        type: "onchain-activity",
        source,
        data: {
          pubkey: acc.pubkey,
          owner: acc.account.owner,
          lamports: acc.account.lamports,
          executable: acc.account.executable,
          rentEpoch: acc.account.rentEpoch,
          dataType: typeof acc.account.data === "string" ? "string" : "parsed",
        },
        description: `Solana account ${acc.pubkey.slice(0, 8)}… owned by ${acc.account.owner}`,
      });
    }

    return { success: true, items };
  }

  /**
   * Normalize Helius data to evidence items.
   */
  normalizeHelius(projects: RawProject[] | null | undefined): NormalizeResult {
    if (!Array.isArray(projects)) {
      return { success: true, items: [] };
    }

    const items: EvidenceItem[] = [];

    for (const project of projects) {
      const source: EvidenceSource = {
        id: `helius-${project.id}`,
        provider: "helius",
        timestamp: Date.now(),
        endpoint: "getTokenAccounts",
      };

      items.push({
        id: `helius-${project.id}`,
        type: "wallet-activity",
        source,
        data: {
          name: project.name,
          category: project.category,
          description: project.description,
        },
        description: `Helius: ${project.name}`,
      });
    }

    return { success: true, items };
  }

  /**
   * Generic normalizer for unknown raw project data.
   */
  normalizeGeneric(provider: string, projects: RawProject[] | null | undefined): NormalizeResult {
    if (!Array.isArray(projects)) {
      return { success: true, items: [] };
    }

    const items: EvidenceItem[] = [];

    for (const project of projects) {
      const source: EvidenceSource = {
        id: `${provider}-${project.id}`,
        provider,
        timestamp: Date.now(),
        endpoint: "fetchProjects",
      };

      items.push({
        id: `${provider}-${project.id}`,
        type: "raw-project",
        source,
        data: project,
        description: `${provider}: ${project.name}`,
      });
    }

    return { success: true, items };
  }

  /**
   * Normalize any provider's fetchProjects output.
   * Dispatches to provider-specific normalizer based on provider id.
   */
  normalizeFromProvider(
    providerId: string,
    data: RawProject[] | null | undefined,
  ): NormalizeResult {
    if (!Array.isArray(data)) {
      return { success: true, items: [] };
    }

    switch (providerId) {
      case "coingecko":
        return this.normalizeCoinGecko(data as unknown as RawCoinGeckoMarketAsset[]);
      case "defillama":
        return this.normalizeDeFiLlama(data as unknown as RawDefiLlamaProtocol[]);
      case "solana-rpc":
        return this.normalizeSolana(data as unknown as RawProgramData[]);
      case "helius":
        return this.normalizeHelius(data);
      default:
        return this.normalizeGeneric(providerId, data);
    }
  }
}
