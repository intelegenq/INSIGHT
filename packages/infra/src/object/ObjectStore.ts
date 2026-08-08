/**
 * @insight/infra/object — S3-compatible object storage.
 *
 * Blob/artifact storage for generated artifacts (rendered reports, evidence
 * references). Backend-agnostic: the injected contract mirrors the
 * AWS-SDK v3 S3 client methods M26 needs (put/get/delete). Tests use the
 * bundled in-memory store; production supplies a real S3/MinIO client.
 */

/** A stored object entry. */
export interface ObjectStoreEntry {
  /** Object/key identifier. */
  key: string;
  /** Raw bytes. */
  body: Uint8Array;
  /** Content type when known. */
  contentType?: string;
}

/** Minimal S3-compatible object store contract. */
export interface ObjectStore {
  /** Store an object under `key`. */
  put(entry: ObjectStoreEntry): Promise<void>;
  /** Fetch an object's bytes, or undefined when missing. */
  get(key: string): Promise<Uint8Array | undefined>;
  /** Remove an object; returns true when present. */
  delete(key: string): Promise<boolean>;
  /** Whether a key exists. */
  exists(key: string): Promise<boolean>;
}

/**
 * InMemoryObjectStore — deterministic, test/fallback object store.
 * Backs objects in a Map; no external infrastructure required.
 */
export class InMemoryObjectStore implements ObjectStore {
  private readonly store = new Map<string, { body: Uint8Array; contentType?: string }>();

  async put(entry: ObjectStoreEntry): Promise<void> {
    this.store.set(entry.key, { body: entry.body, contentType: entry.contentType });
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    return this.store.get(key)?.body;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}