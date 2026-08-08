/**
 * @insight/infra/security — API input/security validation controls.
 *
 * Deterministic helpers for input/authorization security:
 *   - JSON-safe input parsing with size limits (anti-blow-up)
 *   - Secret/credential redaction for safe logging
 *   - Simple authorization scope check (authZ)
 *   - Sliding-window-ish rate limiting (token-bucket, testable on a clock)
 *
 * No external infrastructure required; all state is injected/in-memory.
 */
import type { ObservabilitySink } from "../observability/observability";
import { noopSink } from "../observability/observability";

/* ── Secret handling ─────────────────────────────────────────────── */

const SENSITIVE_PATTERNS = [
  /api[_-]?key["']?\s*[:=]\s*["'][^"']{4,}["']/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /sk_[A-Za-z0-9]{16,}/g,
] as const;

/** Redact secret-looking values from a string (for safe log emission). */
export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

/**
 * Sanitize an object before logging: recursively redacts values under
 * known secret key names.
 */
const SECRET_KEYS = new Set(["apiKey", "api_key", "token", "secret", "password", "authorization", "privateKey"]);

export function sanitizeForLog<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForLog(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] = typeof v === "string" && keyIsSecret(k) ? "[REDACTED]" : sanitizeForLog(v as unknown);
    }
    return out as unknown as T;
  }
  return typeof value === "string" ? (redactSecrets(value) as unknown as T) : value;
}

function keyIsSecret(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEYS.has(lower) || lower.includes("secret") || lower.includes("token");
}

/* ── Input validation ────────────────────────────────────────────── */

export interface ParseJsonOptions {
  /** Maximum accepted payload length in bytes. */
  maxBytes?: number;
}

/** Parse untrusted JSON with a hard size cap. Throws on oversize/invalid. */
export function parseInputJson(raw: string, options: ParseJsonOptions = {}): unknown {
  const maxBytes = options.maxBytes ?? 1_000_000;
  if (raw.length > maxBytes) {
    throw new Error(`Payload exceeds ${maxBytes} bytes`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

/** Trim + length-validate a required string field. Throws when invalid. */
export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

/* ── authZ (authorization scope check) ────────────────────────────── */

export type Scope = string;

/** Resolve whether a principal holds the required scope. Deterministic. */
export function hasScope(granted: readonly Scope[], required: Scope): boolean {
  return granted.includes(required);
}

/* ── Rate limiting ────────────────────────────────────────────────── */

export interface RateLimitConfig {
  /** Max requests allowed per window. */
  capacity: number;
  /** Window size in ms; tokens refill over the window. */
  windowMs: number;
}

/**
 * Sliding-window token bucket. Deterministic under an injectable clock.
 * complicates determinism if pure, so state is kept in the instance.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill = 0;
  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private sink: ObservabilitySink;

  constructor(config: RateLimitConfig, now: () => number = () => Date.now(), sink: ObservabilitySink = noopSink) {
    this.capacity = config.capacity;
    this.windowMs = config.windowMs;
    this.tokens = config.capacity;
    this.now = now;
    this.sink = sink;
  }

  /** True when a token is available and consumed. */
  allow(key: string): boolean {
    this.refill();
    const permitted = this.tokens >= 1;
    const timestamp = new Date(this.now()).toISOString();
    if (permitted) {
      this.tokens -= 1;
      this.sink.metric({ name: "rate_limit.allow", delta: 1, timestamp });
    } else {
      this.sink.metric({ name: "rate_limit.deny", delta: 1, timestamp });
    }
    return permitted;
  }

  private refill(): void {
    const now = this.now();
    const elapsed = now - this.lastRefill;
    const refill = (elapsed / this.windowMs) * this.capacity;
    this.tokens = Math.min(this.capacity, this.tokens + refill);
    this.lastRefill = now;
  }
}