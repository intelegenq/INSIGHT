import type { ConfidenceInput } from "./SignalTypes";

/**
 * ConfidenceCalculator — deterministic confidence scoring for intelligence signals.
 *
 * Responsibilities:
 * - Calculate confidence (0-1) based on evidence quantity, diversity, quality
 * - Pure function, no external dependencies
 * - No AI, no external models, no network calls
 */
export class ConfidenceCalculator {
  /**
   * Calculate confidence score from evidence characteristics.
   *
   * Formula:
   * - Base: 0.1
   * - Evidence count factor: min(0.3, count * 0.05)
   * - Provider diversity factor: min(0.25, providers * 0.1)
   * - Correlation strength factor: correlationStrength * 0.2
   * - Recency factor: recency * 0.15
   * - Evidence type diversity: min(0.15, types * 0.05)
   *
   * Max possible: 0.1 + 0.3 + 0.25 + 0.2 + 0.15 + 0.15 = 1.15 → clamped to 1.0
   */
  calculate(input: ConfidenceInput): number {
    const { evidenceCount, providerCount, correlationStrength, recency, evidenceTypes } = input;

    // Base confidence
    let confidence = 0.1;

    // Evidence count factor (0-0.3)
    // 1 evidence = 0.05, 6+ = 0.3
    const countFactor = Math.min(0.3, evidenceCount * 0.05);
    confidence += countFactor;

    // Provider diversity factor (0-0.25)
    // 1 provider = 0.0, 2 = 0.1, 3+ = 0.25
    const providerFactor = Math.min(0.25, Math.max(0, (providerCount - 1) * 0.125));
    confidence += providerFactor;

    // Correlation strength factor (0-0.2)
    // Directly proportional to correlation strength
    const correlationFactor = correlationStrength * 0.2;
    confidence += correlationFactor;

    // Recency factor (0-0.15)
    // Provided as 0-1 from correlation engine
    const recencyFactor = recency * 0.15;
    confidence += recencyFactor;

    // Evidence type diversity factor (0-0.15)
    // 1 type = 0.0, 2 = 0.05, 3 = 0.1, 4+ = 0.15
    const typeFactor = Math.min(0.15, Math.max(0, (evidenceTypes - 1) * 0.05));
    confidence += typeFactor;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate confidence with detailed breakdown for debugging.
   */
  calculateDetailed(input: ConfidenceInput): {
    confidence: number;
    breakdown: {
      base: number;
      evidenceCount: number;
      providerDiversity: number;
      correlationStrength: number;
      recency: number;
      typeDiversity: number;
    };
  } {
    const { evidenceCount, providerCount, correlationStrength, recency, evidenceTypes } = input;

    const base = 0.1;
    const countFactor = Math.min(0.3, evidenceCount * 0.05);
    const providerFactor = Math.min(0.25, Math.max(0, (providerCount - 1) * 0.125));
    const correlationFactor = correlationStrength * 0.2;
    const recencyFactor = recency * 0.15;
    const typeFactor = Math.min(0.15, Math.max(0, (evidenceTypes - 1) * 0.05));

    const confidence = Math.max(
      0,
      Math.min(
        1,
        base + countFactor + providerFactor + correlationFactor + recencyFactor + typeFactor,
      ),
    );

    return {
      confidence,
      breakdown: {
        base,
        evidenceCount: countFactor,
        providerDiversity: providerFactor,
        correlationStrength: correlationFactor,
        recency: recencyFactor,
        typeDiversity: typeFactor,
      },
    };
  }
}
