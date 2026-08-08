import type { IntelligenceSignal, SignalEngineConfig, CorrelationResult } from "./SignalTypes";
import type { EvidenceCollection } from "@insight/data";
import { CorrelationEngine } from "./CorrelationEngine";
import { ConfidenceCalculator } from "./ConfidenceCalculator";

/**
 * SignalEngine — main entry point for generating intelligence signals from evidence.
 *
 * Deterministic by contract: same collection + same `referenceDate` always
 * produces the same signals with the same IDs, confidences, and timestamps.
 *
 * Responsibilities:
 * - Accept EvidenceCollection from data layer
 * - Run correlation analysis
 * - Calculate confidence scores
 * - Emit IntelligenceSignal objects
 * - No data fetching, no API calls, no financial advice
 *
 * The `referenceDate` parameter on `generateSignals` is the single source of
 * truth for any time-derived quantity (recency factor, signal timestamp).
 * When omitted, it falls back to a value derived from the collection itself.
 */
export class SignalEngine {
  private readonly correlationEngine: CorrelationEngine;
  private readonly confidenceCalculator: ConfidenceCalculator;
  private readonly config: Required<SignalEngineConfig>;

  constructor(config: SignalEngineConfig = {}) {
    this.correlationEngine = new CorrelationEngine();
    this.confidenceCalculator = new ConfidenceCalculator();
    this.config = {
      minConfidence: config.minConfidence ?? 0.3,
      minEvidenceCount: config.minEvidenceCount ?? 2,
      includeWeakSignals: config.includeWeakSignals ?? false,
      customRules: config.customRules ?? [],
    };
  }

  /**
   * Generate intelligence signals from an evidence collection.
   *
   * @param collection Evidence collection to analyze.
   * @param referenceDate Optional ISO-8601 timestamp used for recency and
   *   signal timestamps. When omitted, the engine uses the collection's
   *   most recent observed timestamp (deterministic, no wall-clock reads).
   */
  generateSignals(
    collection: EvidenceCollection<unknown>,
    referenceDate?: string,
  ): IntelligenceSignal[] {
    if (collection.items.length < this.config.minEvidenceCount) {
      return [];
    }

    const resolvedReferenceMs = resolveReferenceMs(collection, referenceDate);

    // Step 1: Find correlations
    const correlations = this.correlationEngine.analyze(collection, referenceDate);

    // Step 2: Generate signals from correlations
    const signals: IntelligenceSignal[] = [];

    for (const correlation of correlations) {
      const signal = this.correlationToSignal(correlation, collection, resolvedReferenceMs);
      if (signal.confidence >= this.config.minConfidence) {
        signals.push(signal);
      } else if (this.config.includeWeakSignals) {
        signals.push(signal);
      }
    }

    // Step 3: Apply custom rules (even if no correlations found)
    for (const rule of this.config.customRules) {
      const customSignals = this.applyCustomRule(rule, collection, resolvedReferenceMs);
      for (const signal of customSignals) {
        if (signal.confidence >= this.config.minConfidence || this.config.includeWeakSignals) {
          signals.push(signal);
        }
      }
    }

    // If no correlations and no custom rules, return empty
    if (correlations.length === 0 && this.config.customRules.length === 0) {
      return [];
    }

    // Sort by confidence descending
    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Convert a correlation result to an intelligence signal.
   * IDs and timestamps are deterministic functions of inputs.
   */
  private correlationToSignal(
    correlation: CorrelationResult,
    collection: EvidenceCollection<unknown>,
    referenceMs: number,
  ): IntelligenceSignal {
    const evidenceIds = correlation.evidenceItems.map((i) => i.id);
    const providerCount = new Set(correlation.evidenceItems.map((i) => i.source.provider)).size;
    const primaryCategory = this.inferPrimaryCategory(correlation.evidenceItems);

    const supportingEvidence = correlation.evidenceItems.map((item) => ({
      evidenceId: item.id,
      relationship: this.inferRelationship(correlation.correlationType, item.type),
      weight: this.calculateEvidenceWeight(item, correlation),
    }));

    const confidence = this.confidenceCalculator.calculate({
      evidenceCount: correlation.evidenceItems.length,
      providerCount,
      correlationStrength: correlation.strength,
      recency: this.calculateRecencyFactor(correlation.evidenceItems, referenceMs),
      evidenceTypes: [...new Set(correlation.evidenceItems.map((i) => i.type))].length,
    });

    const strength = this.classifyStrength(confidence);

    return {
      id: buildSignalId("corr", correlation.correlationType, evidenceIds),
      type: this.mapCorrelationToSignalType(correlation.correlationType),
      title: this.generateTitle(correlation, providerCount),
      description: correlation.description,
      confidence,
      evidenceIds,
      supportingEvidence,
      timestamp: referenceMs,
      metadata: {
        providerCount,
        primaryCategory,
        strength,
      },
    };
  }

  /**
   * Apply a custom correlation rule.
   */
  private applyCustomRule(
    rule: NonNullable<SignalEngineConfig["customRules"]>[number],
    collection: EvidenceCollection<unknown>,
    referenceMs: number,
  ): IntelligenceSignal[] {
    const matchingItems = collection.items.filter((item) =>
      rule.applicableTypes.includes(item.type),
    );

    if (matchingItems.length < rule.minMatches) {
      return [];
    }

    const confidence = this.confidenceCalculator.calculate({
      evidenceCount: matchingItems.length,
      providerCount: new Set(matchingItems.map((i) => i.source.provider)).size,
      correlationStrength: 0.5, // Custom rules have base strength
      recency: this.calculateRecencyFactor(matchingItems, referenceMs),
      evidenceTypes: [...new Set(matchingItems.map((i) => i.type))].length,
    });

    if (confidence < this.config.minConfidence && !this.config.includeWeakSignals) {
      return [];
    }

    const matchingIds = matchingItems.map((i) => i.id);
    const providerCount = new Set(matchingItems.map((i) => i.source.provider)).size;

    return [
      {
        id: buildSignalId("rule", rule.id, matchingIds),
        type: rule.signalType,
        title: rule.titleTemplate.replace("{count}", matchingItems.length.toString()),
        description: rule.descriptionTemplate.replace("{count}", matchingItems.length.toString()),
        confidence,
        evidenceIds: matchingIds,
        supportingEvidence: matchingItems.map((item) => ({
          evidenceId: item.id,
          relationship: "matches-rule",
          weight: 1 / matchingItems.length,
        })),
        timestamp: referenceMs,
        metadata: {
          providerCount,
          primaryCategory: this.inferPrimaryCategory(matchingItems),
          strength: this.classifyStrength(confidence),
        },
      },
    ];
  }

  /** Map correlation type to signal type. */
  private mapCorrelationToSignalType(correlationType: string): string {
    const map: Record<string, string> = {
      "market-ecosystem-correlation": "ecosystem-growth",
      "adoption-activity-correlation": "ecosystem-growth",
      "multi-provider-validation": "ecosystem-growth",
      "entity-multi-facet": "protocol-momentum",
    };
    return map[correlationType] ?? "unknown";
  }

  /** Generate human-readable title. */
  private generateTitle(correlation: CorrelationResult, providerCount: number): string {
    const titles: Record<string, string> = {
      "market-ecosystem-correlation": `Market & Protocol Correlation (${providerCount} providers)`,
      "adoption-activity-correlation": `On-chain Adoption Activity (${providerCount} providers)`,
      "multi-provider-validation": `Cross-Provider Validation (${providerCount} providers)`,
      "entity-multi-facet": `Multi-Facet Entity Activity (${providerCount} providers)`,
    };
    return titles[correlation.correlationType] ?? `Correlation: ${correlation.correlationType}`;
  }

  /** Infer primary category from evidence types. */
  private inferPrimaryCategory(items: EvidenceCollection<unknown>["items"]): string {
    const typeCounts = new Map<string, number>();
    for (const item of items) {
      typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
    }
    let maxType = "unknown";
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    }
    return maxType;
  }

  /** Infer relationship type. */
  private inferRelationship(correlationType: string, evidenceType: string): string {
    if (correlationType === "multi-provider-validation") return "validates";
    if (correlationType === "entity-multi-facet") return "describes-facet";
    if (evidenceType === "market-movement" || evidenceType === "protocol-tvl") return "supports";
    return "correlates";
  }

  /** Calculate evidence weight in correlation. */
  private calculateEvidenceWeight(
    item: EvidenceCollection<unknown>["items"][0],
    correlation: CorrelationResult,
  ): number {
    return 1 / correlation.evidenceItems.length;
  }

  /**
   * Calculate average recency factor against an explicit reference timestamp.
   * Deterministically bounded; never reads wall-clock time.
   */
  private calculateRecencyFactor(
    items: EvidenceCollection<unknown>["items"],
    referenceMs: number,
  ): number {
    const ages = items.map((i) => Math.max(0, referenceMs - i.source.timestamp));
    const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
    if (avgAge < 3_600_000) return 0.9;
    if (avgAge < 86_400_000) return 0.7;
    if (avgAge < 604_800_000) return 0.4;
    return 0.1;
  }

  /** Classify signal strength. */
  private classifyStrength(confidence: number): "weak" | "moderate" | "strong" {
    if (confidence >= 0.7) return "strong";
    if (confidence >= 0.4) return "moderate";
    return "weak";
  }
}

/**
 * Resolve the reference timestamp (ms since epoch) used for signal IDs
 * and recency calculations.
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

/**
 * Build a deterministic signal ID from a kind, a stable correlation/rule key,
 * and the contributing evidence IDs (sorted to guarantee stability).
 *
 * Uses the FNV-1a 32-bit hash so the result is portable, side-effect-free,
 * and reproducible across runs.
 */
function buildSignalId(kind: string, key: string, evidenceIds: readonly string[]): string {
  const sortedIds = [...evidenceIds].sort();
  const payload = `${kind}|${key}|${sortedIds.join(",")}`;
  return `signal-${payload}-${fnv1a32(payload).toString(16)}`;
}

/** FNV-1a 32-bit hash. Deterministic, zero dependencies. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned 32-bit
  return hash >>> 0;
}
