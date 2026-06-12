/**
 * v0.6.0 Scratchpad.
 *
 * File-based shared state at `<baseDir>/<swarmId>/<filename>`. All writes
 * are atomic (temp file + rename) so concurrent subagent writes never
 * leave a half-written file. JSON ops support both replace and merge
 * semantics — `cost.json` uses merge (so each subagent's contribution
 * is additive), `state.json` uses replace (so the orchestrator's view
 * of the world is always coherent).
 *
 * Path safety: filenames must be relative, no `..`, no `/`, no absolute
 * paths. The swarmId is also validated at construction.
 */

import { mkdir, readFile, writeFile, rename, unlink, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, isAbsolute, basename, dirname } from "node:path";
import type { SwarmId } from "./types.js";

export interface ScratchpadOpts {
  baseDir: string;
  swarmId: SwarmId;
}

const VALID_FILENAME = /^[a-zA-Z0-9._-]+$/;

function assertSafeFilename(name: string): void {
  if (isAbsolute(name)) {
    throw new Error(`Invalid filename "${name}": absolute paths not allowed`);
  }
  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`Invalid filename "${name}": directory separators not allowed`);
  }
  if (name.includes("..")) {
    throw new Error(`Invalid filename "${name}": path traversal not allowed`);
  }
  if (!VALID_FILENAME.test(name)) {
    throw new Error(`Invalid filename "${name}": only [a-zA-Z0-9._-] allowed`);
  }
}

export class Scratchpad {
  private readonly swarmDir: string;

  constructor(private readonly opts: ScratchpadOpts) {
    this.swarmDir = join(opts.baseDir, opts.swarmId);
  }

  /** Absolute path to the swarm directory. */
  get dir(): string {
    return this.swarmDir;
  }

  private filePath(name: string): string {
    assertSafeFilename(name);
    return join(this.swarmDir, name);
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.swarmDir, { recursive: true });
  }

  /** Write a text file atomically. */
  async writeFile(name: string, content: string): Promise<void> {
    await this.ensureDir();
    const finalPath = this.filePath(name);
    // Per-call unique tmp path so concurrent writes to the same target
    // never collide. Final rename is atomic on POSIX.
    const tmpName = `.${basename(name)}.tmp.${process.pid}.${randomBytes(4).toString("hex")}`;
    const tmpPath = join(this.swarmDir, tmpName);
    try {
      await writeFile(tmpPath, content, "utf8");
      await rename(tmpPath, finalPath);
    } catch (e) {
      // Best-effort cleanup of orphan tmp on error
      try { await unlink(tmpPath); } catch {}
      throw e;
    }
  }

  /** Read a text file. Throws if missing. */
  async readFile(name: string): Promise<string> {
    const path = this.filePath(name);
    try {
      return await readFile(path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Scratchpad: file "${name}" not found in swarm ${this.opts.swarmId}`);
      }
      throw e;
    }
  }

  async exists(name: string): Promise<boolean> {
    try {
      assertSafeFilename(name);
      await readFile(this.filePath(name), "utf8");
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(): Promise<string[]> {
    try {
      return (await readdir(this.swarmDir)).filter(f => !f.startsWith("."));
    } catch {
      return [];
    }
  }

  async deleteFile(name: string): Promise<void> {
    try {
      await unlink(this.filePath(name));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      // missing → no-op
    }
  }

  /** Write a JSON object (replace semantics). */
  async writeJSON<T>(name: string, value: T): Promise<void> {
    await this.writeFile(name, JSON.stringify(value, null, 2) + "\n");
  }

  /** Read a JSON object. Throws on parse error or missing file. */
  async readJSON<T>(name: string): Promise<T> {
    const raw = await this.readFile(name);
    return JSON.parse(raw) as T;
  }

  /**
   * Merge a partial object into an existing JSON object. Useful for
   * `cost.json` where each subagent appends its contribution without
   * clobbering the others.
   */
  async mergeJSON<T extends Record<string, unknown>>(name: string, patch: Partial<T>): Promise<void> {
    let current: Record<string, unknown> = {};
    try {
      current = await this.readJSON<Record<string, unknown>>(name);
    } catch {
      // missing → start with empty
    }
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (
        v && typeof v === "object" && !Array.isArray(v) &&
        merged[k] && typeof merged[k] === "object" && !Array.isArray(merged[k])
      ) {
        // shallow-merge nested objects
        merged[k] = { ...(merged[k] as Record<string, unknown>), ...(v as Record<string, unknown>) };
      } else {
        merged[k] = v;
      }
    }
    await this.writeJSON(name, merged as T);
  }
}
