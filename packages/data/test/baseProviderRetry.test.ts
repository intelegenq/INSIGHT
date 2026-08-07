import { describe, expect, it, vi } from "vitest";
import { BaseProvider } from "../src/providers/base/BaseProvider";
import { HttpClient } from "../src/providers/base/HttpClient";
import { MockHttpClient } from "../src/providers/mock/MockHttpClient";
import type {
  ProviderFetch,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../src/interfaces/DataProvider";
import type { Sleeper } from "../src/providers/base/RetryPolicy";

/**
 * BaseProvider exposes a withRetry() helper that wraps the configured
 * RetryPolicy. These tests verify the helper is wired up and that the
 * policy config flows through to actual fetch behavior.
 */
class FlakyProvider extends BaseProvider {
  public attempts = 0;
  constructor(
    options: ConstructorParameters<typeof BaseProvider>[0],
    private readonly failTimes: number,
  ) {
    super(options);
  }
  fetchProjects(): Promise<ProviderFetch<RawProject>> {
    return this.withRetry(async (attempt) => {
      this.attempts = attempt + 1;
      if (attempt < this.failTimes) {
        throw new Error(`transient ${attempt}`);
      }
      return { data: [{ id: "p1", name: "ok", category: "x", description: "" }], asOf: "2024" };
    });
  }
  fetchEvidence(): Promise<ProviderFetch<RawEvidence>> {
    return Promise.resolve({ data: [], asOf: "2024" });
  }
  fetchNarratives(): Promise<ProviderFetch<RawNarrative>> {
    return Promise.resolve({ data: [], asOf: "2024" });
  }
}

describe("BaseProvider — withRetry wiring", () => {
  it("withRetry recovers after a transient failure", async () => {
    const sleeper = vi.fn<Sleeper>(async () => {});
    const provider = new FlakyProvider(
      {
        id: "flaky",
        name: "Flaky",
        httpClient: new HttpClient({}, new MockHttpClient()),
        retry: { maxRetry: 3, baseDelay: 10, maxDelay: 100 },
        sleeper,
      },
      2, // fail first 2 attempts
    );
    const result = await provider.fetchProjects();
    expect(provider.attempts).toBe(3);
    expect(result.data).toHaveLength(1);
    expect(sleeper).toHaveBeenCalledTimes(2);
  });

  it("withRetry rethrows the last error when retries are exhausted", async () => {
    const sleeper = vi.fn<Sleeper>(async () => {});
    const provider = new FlakyProvider(
      {
        id: "always-fails",
        name: "Always Fails",
        httpClient: new HttpClient({}, new MockHttpClient()),
        retry: { maxRetry: 2, baseDelay: 5, maxDelay: 20 },
        sleeper,
      },
      99, // always fail
    );
    await expect(provider.fetchProjects()).rejects.toThrow(/transient/);
    expect(sleeper).toHaveBeenCalledTimes(2);
  });

  it("default policy uses DEFAULT_RETRY_CONFIG (3 retries, 100ms base)", () => {
    const provider = new FlakyProvider(
      {
        id: "default",
        name: "Default",
        httpClient: new HttpClient({}, new MockHttpClient()),
        sleeper: vi.fn<Sleeper>(async () => {}),
      },
      0, // succeed on first try
    );
    expect(provider.retry.config.maxRetry).toBe(3);
    expect(provider.retry.config.baseDelay).toBe(100);
    expect(provider.retry.config.maxDelay).toBe(2_000);
  });
});
