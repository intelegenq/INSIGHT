import type {
  DataProvider,
  ProviderFetch,
  ProviderHealth,
  RawEvidence,
  RawNarrative,
  RawProject,
} from "../../interfaces/DataProvider";
import type { HttpClient } from "./HttpClient";
import { RetryPolicy } from "./RetryPolicy";
import type { RetryConfig } from "./RetryPolicy";
import { RateLimiter } from "./RateLimiter";
import type { RateLimitConfig, Clock } from "./RateLimiter";

/**
 * BaseProvider — abstract foundation for every production provider.
 *
 * Subclasses implement {@link DataProvider}: they acquire raw data only.
 * The base class owns cross-cutting concerns (rate limiting, retry policy,
 * health reporting) so every provider behaves consistently.
 *
 * Providers NEVER map to core types, score, rank, or build graphs — those
 * responsibilities live in the transformer / intelligence / knowledge
 * layers.
 */

export interface BaseProviderOptions {
  /** HTTP client used for all requests. */
  httpClient: HttpClient;
  /** Retry policy configuration (optional). */
  retry?: Partial<RetryConfig>;
  /** Rate limit configuration (optional; disabled when omitted). */
  rateLimit?: RateLimitConfig;
  /** Custom clock for deterministic rate limiting in tests. */
  clock?: Clock;
  /** Unique provider id. */
  id: string;
  /** Human-readable provider name. */
  name: string;
}

/**
 * Abstract provider. Subclasses must provide the id/name, the raw fetchers,
 * and optionally a `checkHealth()` implementation.
 */
export abstract class BaseProvider implements DataProvider {
  readonly id: string;
  readonly name: string;

  protected readonly httpClient: HttpClient;
  protected readonly retry: RetryPolicy;
  protected readonly limiter?: RateLimiter;

  constructor(options: BaseProviderOptions) {
    this.id = options.id;
    this.name = options.name;
    this.httpClient = options.httpClient;
    this.retry = new RetryPolicy(options.retry);
    this.limiter =
      options.rateLimit === undefined
        ? undefined
        : new RateLimiter(options.rateLimit, options.clock);
  }

  /** Acquire permission from the rate limiter; throws when blocked. */
  protected acquire(): void {
    if (this.limiter === undefined) {
      return;
    }
    const result = this.limiter.consume(1);
    if (!result.allowed) {
      throw new Error(`Rate limit exceeded for ${this.id}; retry after ${result.retryAfterMs}ms`);
    }
  }

  /** Default health: available. Override for provider-specific checks. */
  protected async checkHealth(): Promise<boolean> {
    return true;
  }

  async health(): Promise<ProviderHealth> {
    const available = await this.checkHealth();
    return {
      id: this.id,
      name: this.name,
      available,
      note: available ? "provider healthy" : "provider unavailable",
    };
  }

  /** Raw project fetcher — implemented by subclasses. */
  abstract fetchProjects(): Promise<ProviderFetch<RawProject>>;

  /** Raw evidence fetcher — implemented by subclasses. */
  abstract fetchEvidence(): Promise<ProviderFetch<RawEvidence>>;

  /** Raw narrative fetcher — implemented by subclasses. */
  abstract fetchNarratives(): Promise<ProviderFetch<RawNarrative>>;
}
