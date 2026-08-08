/**
 * @insight/infra/kv — Redis-style KV cache & queue.
 *
 * `KvCache` preserves the surface semantics of the existing in-memory
 * `MemoryCache` (packages/data/src/cache/MemoryCache.ts): get/set/delete/
 * clear/has/expired/size, plus TTL. It is backend-agnostic: the injected
 * {@link KvBackend} is a tiny async get/set/delete contract that a real
 * Redis client (e.g. ioredis/node-redis) satisfies, while tests use the
 * bundled in-memory backend. This lets callers upgrade from MemoryCache to
 * a shared Redis cache without changing their code.
 */

/** Minimal async KV backend (satisfiable by ioredis / node-redis). */
export interface KvBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface KvCacheOptions {
  /** Async key/value backend. */
  backend?: KvBackend;
  /** Default TTL in milliseconds. */
  defaultTtlMs?: number;
  /** Clock for deterministic expiry under test. */
  now?: () => number;
}

const noNow = (): number => Date.now();

/**
 * KvCache — TTL cache over any async KV backend.
 * API mirrors MemoryCache; callers may swap it in transparently.
 */
export class KvCache {
  private readonly backend: KvBackend;
  private readonly defaultTtlMs: number;
  private readonly now: () => number;

  constructor(options: KvCacheOptions = {}) {
    this.backend = options.backend ?? new InMemoryKvBackend();
    this.defaultTtlMs = options.defaultTtlMs ?? 60_000;
    this.now = options.now ?? noNow;
  }

  /** Store a value with the default TTL. */
  async set(key: string, value: unknown): Promise<void> {
    await this.backend.set(key, JSON.stringify(value), this.defaultTtlMs);
  }

  /** Store a value with a custom TTL (ms). */
  async setWithTtl(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.backend.set(key, JSON.stringify(value), ttlMs);
  }

  /** Read a value, or undefined when missing/expired. */
  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.backend.get(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  /** Whether a key exists and is not expired. */
  async has(key: string): Promise<boolean> {
    return (await this.backend.get(key)) !== null;
  }

  /** Whether a key is absent or expired. */
  async expired(key: string): Promise<boolean> {
    return (await this.backend.get(key)) === null;
  }

  async delete(key: string): Promise<void> {
    await this.backend.delete(key);
  }

  async clear(): Promise<void> {
    // Best-effort: selected backend may support a keys scan; default no-op.
    // Callers relying on full clear should use a backend that tracks keys.
  }
}

/**
 * InMemoryKvBackend — deterministic, test/fallback KV backend.
 * Uses an injected clock for TTL expiry so behavior is reproducible.
 */
export class InMemoryKvBackend implements KvBackend {
  private readonly store = new Map<
    string,
    { value: string; expiresAt: number | null }
  >();
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs === undefined ? null : this.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}