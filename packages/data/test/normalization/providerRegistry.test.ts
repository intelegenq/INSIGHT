import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../../src/normalization/ProviderRegistry";
import type { ProviderDescriptor, ProviderCapability } from "../../src/normalization";

const makeDescriptor = (overrides: Partial<ProviderDescriptor> = {}): ProviderDescriptor => ({
  id: "test-provider",
  name: "Test Provider",
  version: "1.0.0",
  capabilities: ["ONCHAIN" as ProviderCapability, "MARKET" as ProviderCapability],
  priority: 10,
  enabled: true,
  ...overrides,
});

describe("ProviderRegistry", () => {
  it("register adds a provider", () => {
    const registry = new ProviderRegistry();
    const descriptor = makeDescriptor();

    registry.register(descriptor);

    expect(registry.get("test-provider")).toEqual(descriptor);
  });

  it("unregister removes a provider", () => {
    const registry = new ProviderRegistry();
    const descriptor = makeDescriptor();

    registry.register(descriptor);
    expect(registry.get("test-provider")).toBeDefined();

    registry.unregister("test-provider");
    expect(registry.get("test-provider")).toBeUndefined();
  });

  it("register with duplicate id overwrites existing", () => {
    const registry = new ProviderRegistry();
    const first = makeDescriptor({ name: "First" });
    const second = makeDescriptor({ name: "Second" });

    registry.register(first);
    registry.register(second);

    const retrieved = registry.get("test-provider");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("Second");
  });

  it("lookup returns undefined for missing provider", () => {
    const registry = new ProviderRegistry();

    expect(registry.get("non-existent")).toBeUndefined();
  });

  it("list returns all registered providers", () => {
    const registry = new ProviderRegistry();
    const a = makeDescriptor({ id: "provider-a", name: "Provider A" });
    const b = makeDescriptor({ id: "provider-b", name: "Provider B" });

    registry.register(a);
    registry.register(b);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.id).sort()).toEqual(["provider-a", "provider-b"]);
  });

  it("has returns true for registered provider", () => {
    const registry = new ProviderRegistry();
    const descriptor = makeDescriptor();

    registry.register(descriptor);

    expect(registry.has("test-provider")).toBe(true);
    expect(registry.has("other")).toBe(false);
  });

  it("clear removes all providers", () => {
    const registry = new ProviderRegistry();
    const a = makeDescriptor({ id: "a" });
    const b = makeDescriptor({ id: "b" });

    registry.register(a);
    registry.register(b);
    expect(registry.list()).toHaveLength(2);

    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});
