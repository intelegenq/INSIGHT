/**
 * @insight/data/normalization — Provider descriptor model.
 *
 * Describes a data provider's metadata and capabilities.
 * Used for provider registration and routing.
 */
import type { ProviderCapability } from "./ProviderCapability";

/**
 * ProviderDescriptor — metadata about a data provider.
 */
export interface ProviderDescriptor {
  /** Unique identifier for the provider (e.g., "coingecko", "defillama"). */
  id: string;

  /** Human-readable name. */
  name: string;

  /** Version of the provider implementation or API version. */
  version: string;

  /** List of capabilities this provider supports. */
  capabilities: ProviderCapability[];

  /** Priority for ordering (lower number = higher priority). */
  priority: number;

  /** Whether the provider is enabled for collection. */
  enabled: boolean;
}
