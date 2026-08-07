/**
 * Cache policy — pure configuration for the memory cache.
 */
export interface CachePolicy {
  /** Time-to-live in milliseconds. Default: 60_000. */
  ttlMs: number;
  /** Maximum number of entries. Default: 100. */
  maxEntries: number;
}

export const DEFAULT_CACHE_POLICY: CachePolicy = {
  ttlMs: 60_000,
  maxEntries: 100,
};

/** Build a policy with sane defaults, overriding only provided fields. */
export function policy(overrides: Partial<CachePolicy> = {}): CachePolicy {
  return {
    ttlMs: overrides.ttlMs ?? DEFAULT_CACHE_POLICY.ttlMs,
    maxEntries: overrides.maxEntries ?? DEFAULT_CACHE_POLICY.maxEntries,
  };
}
