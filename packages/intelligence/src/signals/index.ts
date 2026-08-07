/**
 * Signals barrel export.
 */

export { SignalEngine } from "./SignalEngine";
export { CorrelationEngine } from "./CorrelationEngine";
export { ConfidenceCalculator } from "./ConfidenceCalculator";

export type {
  IntelligenceSignal,
  SignalEvidence,
  CorrelationResult,
  SignalEngineConfig,
  CorrelationRule,
  ConfidenceInput,
  SignalType,
} from "./SignalTypes";

export { SIGNAL_TYPES } from "./SignalTypes";
