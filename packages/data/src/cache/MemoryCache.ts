import type { CachePolicy } from "./CachePolicy";
import { DEFAULT_CACHE_POLICY } from "./CachePolicy";

/**
 * MemoryCache — a tiny in-memory TTL cache.
 *
 * Fully isolated: no Redis, no filesystem, no database. A clock function is
 * injected so behavior is deterministic under test.
 */
export class MemoryCache {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly policy: CachePolicy;
  private readonly now: () => number;

  constructor(policy: CachePolicy = DEFAULT_CACHE_POLICY, now: () => number = () => Date.now()) {
    this.policy = policy;
    this.now = now;
  }

  /** Store a value with the policy TTL. */
  set(key: string, value: unknown): void {
    this.evictExpired();
    const expiresAt = this.now() + this.policy.ttlMs;
    this.store.set(key, { value, expiresAt });
    if (this.store.size > this.policy.maxEntries) {
      this.evictOldest();
    }
  }

  /** Read a value; returns undefined when missing or expired. */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /** Remove a single key. */
  delete(key: string): void {
    this.store.delete(key);
  }

  /** Remove everything. */
  clear(): void {
    this.store.clear();
  }

  /** True when the key is absent or its TTL has elapsed. */
  expired(key: string): boolean {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return true;
    }
    return entry.expiresAt <= this.now();
  }

  /** Number of live entries. */
  size(): number {
    this.evictExpired();
    return this.store.size;
  }

  /** True when the key exists and is not expired. */
  has(key: string): boolean {
    return !this.expired(key);
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestExpiry = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }
}
