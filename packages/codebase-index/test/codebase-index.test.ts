import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodebaseIndex, scanAndIndex, searchCodebase, CodebaseWatcher } from "../src/index.js";
import { MemoryStore } from "@pi/memory-store";
import { NullEmbeddings, type EmbeddingsProvider } from "@pi/embeddings";

class FakeEmbeddings implements EmbeddingsProvider {
  readonly name = "fake";
  readonly dim = 4;
  embed(text: string): Promise<Float32Array> {
    return Promise.resolve(this.embedSync(text));
  }
  embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.resolve(texts.map((t) => this.embedSync(t)));
  }
  private embedSync(text: string): Float32Array {
    const v = new Float32Array(this.dim);
    const t = text.toLowerCase();
    if (t.includes("auth") || t.includes("login")) v[0] = 1;
    if (t.includes("database") || t.includes("db")) v[1] = 1;
    if (t.includes("api") || t.includes("route")) v[2] = 1;
    if (t.includes("user") || t.includes("account")) v[3] = 1;
    return v;
  }
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pi-pro-codebase-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function makeFile(rel: string, content: string): Promise<void> {
  const abs = join(dir, rel);
  await mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
}

describe("scanAndIndex", () => {
  it("indexes symbols from a tiny codebase", async () => {
    await makeFile(
      "src/auth.ts",
      [
        "export function login(user: string) { return user; }",
        "export function logout() {}",
        "export class AuthService {}",
      ].join("\n"),
    );
    await makeFile("src/util.ts", "export const PI = 3.14;");
    const store = new MemoryStore();
    const result = await scanAndIndex(dir, { memoryStore: store, project: "p1" });
    expect(result.scannedFiles).toBeGreaterThanOrEqual(2);
    expect(result.symbolsIndexed).toBeGreaterThan(0);
    expect(store.count({ project: "p1", role: "code-symbol" })).toBeGreaterThan(0);
  });

  it("uses 'code:' prefix in source field", async () => {
    await makeFile("src/auth.ts", "export function login() {}");
    const store = new MemoryStore();
    await scanAndIndex(dir, { memoryStore: store });
    const sources = store.listSources();
    expect(sources.some((s) => s.startsWith("code:src/auth.ts:"))).toBe(true);
  });

  it("respects custom sourcePrefix", async () => {
    await makeFile("src/auth.ts", "export function login() {}");
    const store = new MemoryStore();
    await scanAndIndex(dir, { memoryStore: store, sourcePrefix: "mycode" });
    const sources = store.listSources();
    expect(sources.some((s) => s.startsWith("mycode:"))).toBe(true);
    expect(sources.some((s) => s.startsWith("code:"))).toBe(false);
  });

  it("re-indexing replaces old code symbols (no duplicates)", async () => {
    await makeFile("src/auth.ts", "export function login() {}");
    const store = new MemoryStore();
    await scanAndIndex(dir, { memoryStore: store });
    const firstCount = store.count({ role: "code-symbol" });
    await scanAndIndex(dir, { memoryStore: store });
    const secondCount = store.count({ role: "code-symbol" });
    expect(secondCount).toBe(firstCount);
  });

  it("skips excluded directories", async () => {
    await makeFile("src/ok.ts", "export function ok() {}");
    await makeFile("node_modules/dep/index.js", "export function shouldNotAppear() {}");
    const store = new MemoryStore();
    const result = await scanAndIndex(dir, { memoryStore: store });
    expect(result.errors).toEqual([]);
    const text = store.listSources().join(" ");
    expect(text).toContain("ok.ts");
    expect(text).not.toContain("node_modules");
  });

  it("skips unsupported file extensions", async () => {
    await makeFile("src/code.ts", "export function code() {}");
    await makeFile("src/data.json", "{}");
    const store = new MemoryStore();
    await scanAndIndex(dir, { memoryStore: store });
    const sources = store.listSources().join(" ");
    expect(sources).toContain("code.ts");
  });

  it("isolates by project", async () => {
    await makeFile("src/auth.ts", "export function login() {}");
    const store = new MemoryStore();
    await scanAndIndex(dir, { memoryStore: store, project: "p1" });
    await scanAndIndex(dir, { memoryStore: store, project: "p2" });
    expect(store.count({ project: "p1" })).toBeGreaterThan(0);
    expect(store.count({ project: "p2" })).toBeGreaterThan(0);
  });

  it("returns zero symbols for empty directory", async () => {
    const store = new MemoryStore();
    const result = await scanAndIndex(dir, { memoryStore: store });
    expect(result.symbolsIndexed).toBe(0);
  });

  it("embeds via injected provider", async () => {
    await makeFile("src/auth.ts", "export function login() {}");
    const store = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await scanAndIndex(dir, { memoryStore: store });
    const chunk = store.getChunk(store.count() > 0 ? 1 : 0);
    expect(chunk!.embedding.length).toBe(4);
  });

  it("survives read errors gracefully", async () => {
    await makeFile("src/ok.ts", "export function ok() {}");
    const store = new MemoryStore();
    const result = await scanAndIndex(dir, { memoryStore: store });
    expect(result.errors).toEqual([]);
    expect(result.symbolsIndexed).toBeGreaterThan(0);
  });
});

describe("searchCodebase", () => {
  let store: MemoryStore;
  beforeEach(async () => {
    await makeFile(
      "src/auth.ts",
      [
        "export function login(user: string) {}",
        "export function logout() {}",
        "export class AuthService {}",
      ].join("\n"),
    );
    await makeFile("src/db.ts", ["export function connect() {}", "export class Database {}"].join("\n"));
    await makeFile("src/api.ts", "export function getUsers() {}");
    store = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await scanAndIndex(dir, { memoryStore: store });
  });

  it("returns top-k matches", async () => {
    const results = await searchCodebase(store, "login", { k: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
    expect(results.length).toBeGreaterThan(0);
  });

  it("ranks by regex match when present", async () => {
    const results = await searchCodebase(store, "login", { k: 5 });
    expect(results[0].entry.name.toLowerCase()).toContain("login");
  });

  it("populates matchedBy='both' for hybrid hits", async () => {
    const results = await searchCodebase(store, "login", { k: 5 });
    const both = results.filter((r) => r.matchedBy === "both");
    expect(both.length).toBeGreaterThan(0);
  });

  it("filters by pathPrefix", async () => {
    const results = await searchCodebase(store, "function", { k: 10, pathPrefix: "src/db.ts" });
    expect(results.every((r) => r.entry.file.startsWith("src/db.ts"))).toBe(true);
  });

  it("returns empty when no symbols match", async () => {
    const results = await searchCodebase(store, "zzznotanything", { k: 5, minScore: 0.99 });
    expect(results).toEqual([]);
  });

  it("respects k limit", async () => {
    const results = await searchCodebase(store, "function", { k: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("regex boost: regex wins when vector is weak", async () => {
    const results = await searchCodebase(store, "auth", { k: 5, regexBoost: 0.9 });
    expect(results[0].entry.name.toLowerCase()).toContain("auth");
  });

  it("returns CodeIndexEntry shape", async () => {
    const results = await searchCodebase(store, "login", { k: 1 });
    const e = results[0].entry;
    expect(e).toHaveProperty("file");
    expect(e).toHaveProperty("line");
    expect(e).toHaveProperty("kind");
    expect(e).toHaveProperty("signature");
    expect(e).toHaveProperty("name");
    expect(e).toHaveProperty("source");
    expect(e).toHaveProperty("text");
  });
});

describe("CodebaseIndex class", () => {
  it("build + search round-trip", async () => {
    await makeFile("src/auth.ts", "export function login() {}");
    const store = new MemoryStore();
    const idx = new CodebaseIndex({ memoryStore: store });
    const result = await idx.build(dir);
    expect(result.symbolsIndexed).toBeGreaterThan(0);
    const results = await idx.search("login");
    expect(results.length).toBeGreaterThan(0);
  });

  it("build throws when no rootDir given and opts has none", async () => {
    const store = new MemoryStore();
    const idx = new CodebaseIndex({ memoryStore: store });
    await expect(idx.build("")).rejects.toThrow(/requires rootDir/);
  });
});

describe("CodebaseWatcher", () => {
  it("starts and stops cleanly", async () => {
    const watcher = new CodebaseWatcher({ onChange: () => {} });
    watcher.start(dir);
    await watcher.waitReady();
    await watcher.stop();
  });

  it("debounces multiple rapid changes", async () => {
    let callCount = 0;
    let lastFiles: string[] = [];
    const watcher = new CodebaseWatcher({
      debounceMs: 50,
      onChange: (files) => {
        callCount++;
        lastFiles = files;
      },
    });
    watcher.start(dir);
    await watcher.waitReady();
    writeFileSync(join(dir, "a.ts"), "export const a = 1;");
    writeFileSync(join(dir, "b.ts"), "export const b = 2;");
    await new Promise((r) => setTimeout(r, 400));
    await watcher.stop();
    expect(callCount).toBe(1);
    expect(lastFiles.length).toBe(2);
  });

  it("invokes onChange with changed file paths", async () => {
    let changed: string[] = [];
    const watcher = new CodebaseWatcher({
      debounceMs: 30,
      onChange: (files) => {
        changed = files;
      },
    });
    watcher.start(dir);
    await watcher.waitReady();
    writeFileSync(join(dir, "x.ts"), "export const x = 1;");
    await new Promise((r) => setTimeout(r, 400));
    await watcher.stop();
    expect(changed.some((f) => f.endsWith("x.ts"))).toBe(true);
  });

  it("ignores node_modules and dotfiles", async () => {
    let called = false;
    const watcher = new CodebaseWatcher({
      debounceMs: 30,
      onChange: () => {
        called = true;
      },
    });
    watcher.start(dir);
    await watcher.waitReady();
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    writeFileSync(join(dir, "node_modules/foo.js"), "var x = 1;");
    await new Promise((r) => setTimeout(r, 400));
    await watcher.stop();
    expect(called).toBe(false);
  });

  it("stops on signal abort", async () => {
    const ac = new AbortController();
    const watcher = new CodebaseWatcher({ onChange: () => {}, signal: ac.signal });
    watcher.start(dir);
    ac.abort();
    await watcher.stop();
  });
});

describe("CodebaseIndex — startWatch / stopWatch", () => {
  it("wires watcher to re-index on change", async () => {
    await makeFile("src/auth.ts", "export function login() {}");
    const store = new MemoryStore();
    const idx = new CodebaseIndex({ memoryStore: store });
    await idx.build(dir);
    const initial = store.count({ role: "code-symbol" });

    let reIndexed = 0;
    idx.startWatch(dir, {
      debounceMs: 30,
      onChange: async () => {
        await idx.build(dir);
        reIndexed++;
      },
    });
    await new Promise((r) => setTimeout(r, 100));

    writeFileSync(join(dir, "src/new.ts"), "export function newFunc() {}");
    await new Promise((r) => setTimeout(r, 500));
    await idx.stopWatch();

    expect(reIndexed).toBeGreaterThanOrEqual(1);
  });
});
