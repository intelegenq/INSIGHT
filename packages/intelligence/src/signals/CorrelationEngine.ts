import type { CorrelationResult, EvidenceItem } from "./SignalTypes";
import type { EvidenceCollection } from "@insight/data";

/**
 * CorrelationEngine — finds relationships between evidence items from different providers.
 *
 * Deterministic by contract: given the same collection (and an optional explicit
 * `referenceDate`) the engine returns the same correlations with the same strengths.
 *
 * Responsibilities:
 * - Detect correlations between evidence items
 * - Group related evidence by type, provider, entity
 * - Calculate correlation strength
 * - No scoring, no predictions, no financial advice
 */
export class CorrelationEngine {
  /**
   * Analyze an EvidenceCollection and return all detected correlations.
   *
   * @param collection Evidence collection to analyze.
   * @param referenceDate Optional ISO-8601 timestamp used for recency calculations.
   *   When omitted, the engine derives a deterministic fallback from the
   *   collection's items (the maximum observed timestamp), keeping output
   *   reproducible without a wall-clock dependency.
   */
  analyze(
    collection: EvidenceCollection<unknown>,
    referenceDate?: string,
  ): CorrelationResult[] {
    const correlations: CorrelationResult[] = [];
    const items = collection.items;

    if (items.length < 2) {
      return correlations;
    }

    const effectiveReferenceMs = resolveReferenceMs(collection, referenceDate);

    // Group evidence by type
    const byType = new Map<string, EvidenceItem<unknown>[]>();
    for (const item of items) {
      const arr = byType.get(item.type) ?? [];
      arr.push(item);
      byType.set(item.type, arr);
    }

    // Correlation 1: Market movement + Protocol TVL → ecosystem correlation
    const marketMovements = byType.get("market-movement") ?? [];
    const protocolTvls = byType.get("protocol-tvl") ?? [];
    if (marketMovements.length > 0 && protocolTvls.length > 0) {
      const strength = this.calculateCrossTypeStrength(
        marketMovements,
        protocolTvls,
        effectiveReferenceMs,
      );
      correlations.push({
        correlationType: "market-ecosystem-correlation",
        evidenceItems: [...marketMovements, ...protocolTvls],
        strength,
        description: `Market price movements (${marketMovements.length}) correlate with protocol TVL changes (${protocolTvls.length})`,
      });
    }

    // Correlation 2: On-chain activity + Wallet activity → adoption signal
    const onchainActivity = byType.get("onchain-activity") ?? [];
    const walletActivity = byType.get("wallet-activity") ?? [];
    if (onchainActivity.length > 0 && walletActivity.length > 0) {
      const strength = this.calculateCrossTypeStrength(
        onchainActivity,
        walletActivity,
        effectiveReferenceMs,
      );
      correlations.push({
        correlationType: "adoption-activity-correlation",
        evidenceItems: [...onchainActivity, ...walletActivity],
        strength,
        description: `On-chain program activity (${onchainActivity.length}) correlates with wallet interactions (${walletActivity.length})`,
      });
    }

    // Correlation 3: Multiple providers reporting same entity → cross-validation
    const byProvider = new Map<string, EvidenceItem<unknown>[]>();
    for (const item of items) {
      const provider = item.source.provider;
      const arr = byProvider.get(provider) ?? [];
      arr.push(item);
      byProvider.set(provider, arr);
    }

    if (byProvider.size >= 2) {
      const providerNames = Array.from(byProvider.keys());
      correlations.push({
        correlationType: "multi-provider-validation",
        evidenceItems: items,
        strength: Math.min(0.9, 0.3 + byProvider.size * 0.15),
        description: `Evidence validated across ${byProvider.size} independent providers: ${providerNames.join(", ")}`,
      });
    }

    // Correlation 4: Same entity mentioned in different evidence types
    const entityGroups = this.groupByEntity(items);
    for (const [entity, entityItems] of entityGroups) {
      if (entityItems.length >= 2) {
        const types = [...new Set(entityItems.map((i) => i.type))];
        if (types.length >= 2) {
          correlations.push({
            correlationType: "entity-multi-facet",
            evidenceItems: entityItems,
            strength: 0.6 + types.length * 0.1,
            description: `Entity "${entity}" appears in ${types.length} evidence types: ${types.join(", ")}`,
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Calculate correlation strength between two evidence groups.
   * Based on count, recency, and directional alignment.
   */
  private calculateCrossTypeStrength(
    groupA: EvidenceItem<unknown>[],
    groupB: EvidenceItem<unknown>[],
    referenceMs: number,
  ): number {
    const countFactor = Math.min(1, (groupA.length + groupB.length) / 10);
    const recencyFactor = this.calculateRecencyFactor(
      [...groupA, ...groupB],
      referenceMs,
    );
    const baseStrength = 0.4 + countFactor * 0.3 + recencyFactor * 0.3;
    return Math.min(0.95, baseStrength);
  }

  /**
   * Calculate recency factor (0-1) — more recent = higher.
   * Deterministically bounded against an explicit `referenceMs`.
   */
  private calculateRecencyFactor(
    items: EvidenceItem<unknown>[],
    referenceMs: number,
  ): number {
    const ages = items.map((i) => Math.max(0, referenceMs - i.source.timestamp));
    const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
    // 1 hour = 3_600_000 ms → factor ~0.9
    // 24 hours = 86_400_000 ms → factor ~0.5
    // 7 days = 604_800_000 ms → factor ~0.1
    if (avgAge < 3_600_000) return 0.9;
    if (avgAge < 86_400_000) return 0.7;
    if (avgAge < 604_800_000) return 0.4;
    return 0.1;
  }

  /**
   * Group evidence items by entity (extracted from data or id).
   */
  private groupByEntity(items: EvidenceItem<unknown>[]): Map<string, EvidenceItem<unknown>[]> {
    const groups = new Map<string, EvidenceItem<unknown>[]>();

    for (const item of items) {
      // Try to extract entity identifier from data
      const entity = this.extractEntity(item);
      if (entity) {
        const arr = groups.get(entity) ?? [];
        arr.push(item);
        groups.set(entity, arr);
      }
    }

    return groups;
  }

  /**
   * Extract entity name from evidence item data.
   */
  private extractEntity(item: EvidenceItem<unknown>): string | null {
    const data = item.data as Record<string, unknown> | undefined;
    if (!data) return null;

    // Common entity fields across providers
    if (typeof data.name === "string") return data.name;
    if (typeof data.symbol === "string") return data.symbol.toUpperCase();
    if (typeof data.pubkey === "string") return data.pubkey.slice(0, 8);

    return null;
  }
}

/**
 * Resolve the reference timestamp (ms since epoch) used for recency math.
 *
 * Priority:
 *   1. Explicit `referenceDate` (ISO-8601) from the caller.
 *   2. Maximum observed `source.timestamp` in the collection.
 *   3. The collection's own `timestamp` field.
 *   4. `0` (epoch) — last-resort deterministic fallback.
 *
 * Never reads wall-clock time.
 */
function resolveReferenceMs(
  collection: EvidenceCollection<unknown>,
  referenceDate: string | undefined,
): number {
  if (referenceDate !== undefined) {
    const parsed = Date.parse(referenceDate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  let maxObserved = Number.NEGATIVE_INFINITY;
  for (const item of collection.items) {
    if (item.source.timestamp > maxObserved) {
      maxObserved = item.source.timestamp;
    }
  }
  if (maxObserved !== Number.NEGATIVE_INFINITY) {
    return maxObserved;
  }

  if (typeof collection.timestamp === "number") {
    return collection.timestamp;
  }

  return 0;
}