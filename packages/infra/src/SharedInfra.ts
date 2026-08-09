/**
 * SharedInfra — process-wide shared cache and object store.
 *
 * Mirrors SharedSqlClient: resolves a single KvCache and ObjectStore per
 * process. Production wires real Redis/S3 backends; dev/test uses in-memory.
 * Both worker and web app call these factories so they share the same
 * cache and artifact store within a process.
 */
import { resolveInfraConfig } from "./config";
import { InMemoryKvBackend, KvCache } from "./kv/KvCache";
import { InMemoryObjectStore } from "./object/ObjectStore";
import type { ObjectStore } from "./object/ObjectStore";

let sharedCache: KvCache | undefined;
let sharedObjectStore: ObjectStore | undefined;

/**
 * Resolve the process-wide KvCache.
 * Production: Redis-backed when INSIGHT_REDIS_URL is set (dynamic import).
 * Dev/test: InMemoryKvBackend (no external dependencies).
 */
export async function getSharedCache(): Promise<KvCache> {
  if (sharedCache !== undefined) return sharedCache;

  const config = resolveInfraConfig();

  if (!config.redisUrl) {
    sharedCache = new KvCache({ backend: new InMemoryKvBackend() });
    return sharedCache;
  }

  // Production: dynamically import ioredis so it's not a hard dep in dev/test
  try {
    const redisModule = (await import("ioredis")) as {
      default: new (url: string) => {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string, mode: string, ttl: number) => Promise<string>;
        del: (key: string) => Promise<number>;
      };
    };
    const redis = new redisModule.default(config.redisUrl);
    sharedCache = new KvCache({
      backend: {
        get: (key: string) => redis.get(key),
        set: async (key: string, value: string, ttlMs?: number) => {
          if (ttlMs !== undefined) {
            await redis.set(key, value, "PX", ttlMs);
          } else {
            await redis.set(key, value, "PX", 60_000);
          }
        },
        delete: (key: string) => redis.del(key).then(() => undefined),
      },
    });
    return sharedCache;
  } catch {
    // ioredis not installed — fall back to in-memory
    sharedCache = new KvCache({ backend: new InMemoryKvBackend() });
    return sharedCache;
  }
}

/**
 * Resolve the process-wide ObjectStore.
 * Production: S3/MinIO-backed when INSIGHT_S3_ENDPOINT is set (dynamic import).
 * Dev/test: InMemoryObjectStore (no external dependencies).
 */
export async function getSharedObjectStore(): Promise<ObjectStore> {
  if (sharedObjectStore !== undefined) return sharedObjectStore;

  const config = resolveInfraConfig();

  if (!config.s3Endpoint) {
    sharedObjectStore = new InMemoryObjectStore();
    return sharedObjectStore;
  }

  // Production: dynamically import @aws-sdk/client-s3 for MinIO/S3
  try {
    const s3Module = (await import("@aws-sdk/client-s3")) as unknown as {
      S3Client: new (config: { endpoint: string; region: string; forcePathStyle: boolean }) => {
        putObject: (args: {
          Bucket: string;
          Key: string;
          Body: Uint8Array;
          ContentType?: string;
        }) => Promise<unknown>;
        getObject: (args: {
          Bucket: string;
          Key: string;
        }) => Promise<{ Body?: { transformToByteArray: () => Promise<Uint8Array> } }>;
        deleteObject: (args: { Bucket: string; Key: string }) => Promise<unknown>;
        headObject: (args: { Bucket: string; Key: string }) => Promise<unknown>;
      };
    };
    const client = new s3Module.S3Client({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      forcePathStyle: true,
    });
    const bucket = config.s3Bucket;

    sharedObjectStore = {
      put: async (entry: { key: string; body: Uint8Array; contentType?: string }) => {
        await client.putObject({
          Bucket: bucket,
          Key: entry.key,
          Body: entry.body,
          ContentType: entry.contentType,
        });
      },
      get: async (key: string) => {
        try {
          const result = await client.getObject({ Bucket: bucket, Key: key });
          return result.Body?.transformToByteArray();
        } catch {
          return undefined;
        }
      },
      delete: async (key: string) => {
        try {
          await client.deleteObject({ Bucket: bucket, Key: key });
          return true;
        } catch {
          return false;
        }
      },
      exists: async (key: string) => {
        try {
          await client.headObject({ Bucket: bucket, Key: key });
          return true;
        } catch {
          return false;
        }
      },
    };
    return sharedObjectStore;
  } catch {
    // @aws-sdk/client-s3 not installed — fall back to in-memory
    sharedObjectStore = new InMemoryObjectStore();
    return sharedObjectStore;
  }
}

/** Reset shared infra (tests only). */
export function resetSharedInfra(): void {
  sharedCache = undefined;
  sharedObjectStore = undefined;
}
