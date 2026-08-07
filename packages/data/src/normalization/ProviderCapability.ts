/**
 * @insight/data/normalization — Provider capability model.
 *
 * Strongly typed enum-like union representing what a data provider is capable of.
 * Used to describe provider capabilities without runtime dependency.
 */
export type ProviderCapability =
  | "ONCHAIN"
  | "MARKET"
  | "NEWS"
  | "SOCIAL"
  | "DEVELOPMENT"
  | "GOVERNANCE"
  | "MACRO";