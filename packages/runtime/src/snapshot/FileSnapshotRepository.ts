/**
 * @insight/runtime/snapshot — FileSnapshotRepository.
 *
 * Filesystem-backed implementation of {@link SnapshotRepository}. Each
 * snapshot is persisted as a single JSON file named after the snapshot's
 * deterministic id. This keeps the layout simple, debuggable, and
 * trivially portable across hosts.
 *
 * IMPORTANT: This is the only class in the runtime layer that performs
 * I/O. It depends on Node's `fs`/`path` modules and is therefore
 * unsuitable for browser or sandboxed environments — use
 * {@link InMemorySnapshotRepository} there.
 *
 * The repository is intentionally fail-loud: filesystem errors propagate
 * to the caller. A failed save must not be silently swallowed; a
 * successful `save` followed by a failed `save` of the same id simply
 * overwrites the file (id collision implies same content, by design).
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { Snapshot } from "./Snapshot";
import type { AsyncSnapshotRepository } from "./SnapshotRepository";

/** Options for {@link FileSnapshotRepository}. */
export interface FileSnapshotRepositoryOptions {
  /** Directory in which snapshot files are stored. */
  directory: string;
  /** Pretty-print JSON for human readability. Defaults to false. */
  pretty?: boolean;
}

/**
 * File-backed snapshot repository. Each snapshot lives in a single file
 * `<directory>/<id>.json`. Insertion order is recorded in a sibling
 * `.order.json` file. Atomic writes use a temp-then-rename pattern so a
 * crash mid-save cannot leave a partial file visible.
 */
export class FileSnapshotRepository implements AsyncSnapshotRepository {
  private readonly directory: string;
  private readonly pretty: boolean;
  private readonly orderFile: string;
  private order: string[] = [];
  private loaded = false;

  constructor(options: FileSnapshotRepositoryOptions) {
    this.directory = path.resolve(options.directory);
    this.pretty = options.pretty ?? false;
    this.orderFile = path.join(this.directory, ".order.json");
  }

  /** Number of stored snapshots. */
  get size(): number {
    return this.order.length;
  }

  /** Persist a snapshot. */
  async save(snapshot: Snapshot): Promise<Snapshot> {
    await this.ensureLoaded();
    const target = this.pathFor(snapshot.id);
    const payload = this.pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot);
    const tmp = `${target}.tmp-${process.pid}-${Date.now().toString(36)}`;
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, target);
    // Update order (idempotent re-save moves id to the end).
    this.order = this.order.filter((id) => id !== snapshot.id);
    this.order.push(snapshot.id);
    await this.persistOrder();
    return snapshot;
  }

  /** Retrieve a snapshot by id. */
  async get(id: string): Promise<Snapshot | undefined> {
    await this.ensureLoaded();
    try {
      const raw = await fs.readFile(this.pathFor(id), "utf8");
      return JSON.parse(raw) as Snapshot;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return undefined;
      }
      throw err;
    }
  }

  /** List all stored snapshots in insertion order. */
  async list(): Promise<Snapshot[]> {
    await this.ensureLoaded();
    const results: Snapshot[] = [];
    for (const id of this.order) {
      const snap = await this.get(id);
      if (snap !== undefined) {
        results.push(snap);
      }
    }
    return results;
  }

  /** Remove a snapshot by id. */
  async delete(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const before = this.order.length;
    this.order = this.order.filter((entry) => entry !== id);
    if (this.order.length === before) {
      return false;
    }
    try {
      await fs.unlink(this.pathFor(id));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw err;
      }
    }
    await this.persistOrder();
    return true;
  }

  /** Remove all stored snapshots. */
  async clear(): Promise<void> {
    await this.ensureLoaded();
    for (const id of this.order) {
      try {
        await fs.unlink(this.pathFor(id));
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          throw err;
        }
      }
    }
    this.order = [];
    await this.persistOrder();
  }

  private pathFor(id: string): string {
    // The id is a deterministic content hash; sanitize to keep it
    // portable across filesystems (no slashes, no spaces).
    const safe = id.replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this.directory, `${safe}.json`);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    try {
      const raw = await fs.readFile(this.orderFile, "utf8");
      const parsed = JSON.parse(raw) as { order?: unknown };
      if (Array.isArray(parsed.order) && parsed.order.every((e) => typeof e === "string")) {
        this.order = parsed.order as string[];
      } else {
        this.order = [];
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw err;
      }
      this.order = [];
    }
    this.loaded = true;
  }

  private async persistOrder(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    const payload = JSON.stringify({ order: this.order });
    const tmp = `${this.orderFile}.tmp-${process.pid}-${Date.now().toString(36)}`;
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, this.orderFile);
  }
}
