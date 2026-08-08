/**
 * @insight/data/normalization — Provider registry.
 *
 * In-memory registry for provider descriptors.
 * Used to store and retrieve provider metadata and capabilities.
 */
import type { ProviderDescriptor } from "./ProviderDescriptor";

/**
 * ProviderRegistry — manages provider descriptors.
 */
export class ProviderRegistry {
  private readonly descriptors: Map<string, ProviderDescriptor> = new Map();

  /** Register a provider descriptor. */
  register(descriptor: ProviderDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  /** Unregister a provider by its id. */
  unregister(id: string): void {
    this.descriptors.delete(id);
  }

  /** Get a provider descriptor by id. */
  get(id: string): ProviderDescriptor | undefined {
    return this.descriptors.get(id);
  }

  /** List all registered provider descriptors. */
  list(): ProviderDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  /** Check if a provider is registered. */
  has(id: string): boolean {
    return this.descriptors.has(id);
  }

  /** Clear all registered providers. */
  clear(): void {
    this.descriptors.clear();
  }
}
