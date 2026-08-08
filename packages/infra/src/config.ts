/**
 * @insight/infra/config — environment-backed infrastructure config.
 *
 * A tiny typed view of the env vars consumed at injection time. Kept tiny on
 * purpose: it just reads strings/numbers and never imports external drivers,
 * so it is testable and dependency-free. Production wiring (docker-compose)
 * supplies these vars.
 */

export interface InfraConfig {
  /** Connection string for the primary store. */
  postgresUrl?: string;
  /** Redis connection URL. */
  redisUrl?: string;
  /** S3-compatible endpoint (e.g. MinIO URL, or AWS endpoint). */
  s3Endpoint?: string;
  s3Bucket: string;
  s3Region: string;
  /** Worker behaviour. */
  workerIntervalMs: number;
  workerMaxFailures: number;
}

function readEnvInf(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

/** Resolve config from an environment-like object (defaults to process.env). */
export function resolveInfraConfig(
  env: Record<string, string | undefined> = process.env,
): InfraConfig {
  return {
    postgresUrl: env["INSIGHT_POSTGRES_URL"] || env["POSTGRES_URL"],
    redisUrl: env["INSIGHT_REDIS_URL"] || env["REDIS_URL"],
    s3Endpoint: env["INSIGHT_S3_ENDPOINT"] || env["S3_ENDPOINT"],
    s3Bucket: env["INSIGHT_S3_BUCKET"] || env["S3_BUCKET"] || "insight-artifacts",
    s3Region: env["INSIGHT_S3_REGION"] || env["S3_REGION"] || "us-east-1",
    workerIntervalMs: readEnvInf(env["INSIGHT_WORKER_INTERVAL_MS"], 5_000),
    workerMaxFailures: readEnvInf(env["INSIGHT_WORKER_MAX_FAILURES"], 10),
  };
}

/**
 * Resolve which execution mode to use. When no external endpoints are
 * configured, the infra runs fully in-memory (deterministic, no network);
 * when endpoints are present, it uses the real drivers.
 */
export function isInMemory(
  config: Pick<InfraConfig, "postgresUrl" | "redisUrl" | "s3Endpoint">,
): boolean {
  return !config.postgresUrl && !config.redisUrl && !config.s3Endpoint;
}