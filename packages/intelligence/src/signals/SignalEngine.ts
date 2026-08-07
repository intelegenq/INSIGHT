import type { IntelligenceSignal, SignalEngineConfig, CorrelationResult } from "./SignalTypes";
import type { EvidenceCollection } from "@insight/data";
import { CorrelationEngine } from "./CorrelationEngine";
import { ConfidenceCalculator } from "./ConfidenceCalculator";

/**
 * SignalEngine — main entry point for generating intelligence signals from evidence.
 *
 * Responsibilities:
 * - Accept EvidenceCollection from data layer
 * - Run correlation analysis
 * - Calculate confidence scores
 * - Emit IntelligenceSignal objects
 * - No data fetching, no API calls, no financial advice
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
   */
  generateSignals(collection: EvidenceCollection<unknown>): IntelligenceSignal[] {
    if (collection.items.length < this.config.minEvidenceCount) {
      return [];
    }

    // Step 1: Find correlations
    const correlations = this.correlationEngine.analyze(collection);

    // Step 2: Generate signals from correlations
    const signals: IntelligenceSignal[] = [];

    for (const correlation of correlations) {
      const signal = this.correlationToSignal(correlation, collection);
      if (signal.confidence >= this.config.minConfidence) {
        signals.push(signal);
      } else if (this.config.includeWeakSignals) {
        signals.push(signal);
      }
    }

    // Step 3: Apply custom rules (even if no correlations found)
    for (const rule of this.config.customRules) {
      const customSignals = this.applyCustomRule(rule, collection);
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
   */
  private correlationToSignal(
    correlation: CorrelationResult,
    collection: EvidenceCollection<unknown>,
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
      recency: this.calculateAvgRecency(correlation.evidenceItems),
      evidenceTypes: [...new Set(correlation.evidenceItems.map((i) => i.type))].length,
    });

    const strength = this.classifyStrength(confidence);

    return {
      id: `signal-${correlation.correlationType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: this.mapCorrelationToSignalType(correlation.correlationType),
      title: this.generateTitle(correlation, providerCount),
      description: correlation.description,
      confidence,
      evidenceIds,
      supportingEvidence,
      timestamp: Date.now(),
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
      recency: this.calculateAvgRecency(matchingItems),
      evidenceTypes: [...new Set(matchingItems.map((i) => i.type))].length,
    });

    if (confidence < this.config.minConfidence && !this.config.includeWeakSignals) {
      return [];
    }

    return [
      {
        id: `signal-${rule.id}-${Date.now()}`,
        type: rule.signalType,
        title: rule.titleTemplate.replace("{count}", matchingItems.length.toString()),
        description: rule.descriptionTemplate.replace("{count}", matchingItems.length.toString()),
        confidence,
        evidenceIds: matchingItems.map((i) => i.id),
        supportingEvidence: matchingItems.map((item) => ({
          evidenceId: item.id,
          relationship: "matches-rule",
          weight: 1 / matchingItems.length,
        })),
        timestamp: Date.now(),
        metadata: {
          providerCount: new Set(matchingItems.map((i) => i.source.provider)).size,
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

  /** Calculate average recency factor. */
  private calculateAvgRecency(items: EvidenceCollection<unknown>["items"]): number {
    const now = Date.now();
    const ages = items.map((i) => now - i.source.timestamp);
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
