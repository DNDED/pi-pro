import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MemoryStore,
  tokenize,
  embedToBuffer,
  bufferToEmbed,
  indexMarkdown,
  bm25Score,
} from "../src/index.js";
import { NullEmbeddings, type EmbeddingsProvider, cosineSimilarity } from "@pi/embeddings";

class FakeEmbeddings implements EmbeddingsProvider {
  readonly name = "fake";
  readonly dim = 4;
  embed(text: string): Promise<Float32Array> {
    return Promise.resolve(this.embedSync(text));
  }
  embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.resolve(texts.map((t) => this.embedSync(t)));
  }
  embedSync(text: string): Float32Array {
    const v = new Float32Array(this.dim);
    const t = text.toLowerCase();
    if (t.includes("auth") || t.includes("login")) v[0] = 1;
    if (t.includes("database") || t.includes("db")) v[1] = 1;
    if (t.includes("api") || t.includes("endpoint")) v[2] = 1;
    if (t.includes("user") || t.includes("account")) v[3] = 1;
    return v;
  }
}

let dir: string;
let dbPath: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pi-pro-memstore-"));
  dbPath = join(dir, "memory.db");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumerics", () => {
    expect(tokenize("Hello World! 42 foo_bar")).toEqual(["hello", "world", "foo", "bar"]);
  });

  it("drops tokens shorter than 3 chars", () => {
    expect(tokenize("a b cd ef ghij")).toEqual(["ghij"]);
  });

  it("returns empty array for empty / non-alphanumeric input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("!!! ... ??")).toEqual([]);
  });
});

describe("embedToBuffer / bufferToEmbed", () => {
  it("round-trips Float32Array", () => {
    const v = new Float32Array([1.5, -2.25, 3.125, 0]);
    const buf = embedToBuffer(v);
    const back = bufferToEmbed(buf);
    expect(Array.from(back)).toEqual(Array.from(v));
  });

  it("preserves exact byte layout", () => {
    const v = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const buf = embedToBuffer(v);
    expect(buf.byteLength).toBe(16);
    const back = bufferToEmbed(buf);
    for (let i = 0; i < 4; i++) expect(back[i]).toBeCloseTo(v[i], 5);
  });
});

describe("indexMarkdown", () => {
  it("splits on headings", () => {
    const md = [
      "# Title",
      "intro paragraph",
      "",
      "## Section A",
      "section a body",
      "",
      "## Section B",
      "section b body",
    ].join("\n");
    const chunks = indexMarkdown(md, { source: "test.md" });
    expect(chunks).toHaveLength(3);
    expect(chunks[0].text).toContain("# Title");
    expect(chunks[0].text).toContain("intro paragraph");
    expect(chunks[1].text).toContain("## Section A");
    expect(chunks[2].text).toContain("## Section B");
  });

  it("uses given role", () => {
    const md = "# X\nbody";
    const chunks = indexMarkdown(md, { source: "x.md", role: "fact" });
    expect(chunks[0].role).toBe("fact");
  });

  it("defaults role to narrative", () => {
    const chunks = indexMarkdown("# X\nbody", { source: "x.md" });
    expect(chunks[0].role).toBe("narrative");
  });

  it("returns single chunk for content without headings", () => {
    const md = "just a paragraph\nwith no headings";
    const chunks = indexMarkdown(md, { source: "x.md" });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(md.trim());
  });

  it("returns empty array for empty content", () => {
    const chunks = indexMarkdown("", { source: "x.md" });
    expect(chunks).toEqual([]);
  });

  it("records 1-based line numbers", () => {
    const md = ["# Title", "body", "## Subhead", "sub body"].join("\n");
    const chunks = indexMarkdown(md, { source: "x.md" });
    expect(chunks[0].line).toBe(1);
    expect(chunks[1].line).toBe(3);
  });
});

describe("bm25Score", () => {
  it("returns 0 for empty query", () => {
    expect(bm25Score([], ["a", "b"], 2, new Map(), 1)).toBe(0);
  });

  it("returns 0 for empty doc", () => {
    expect(bm25Score(["a"], [], 0, new Map(), 1)).toBe(0);
  });

  it("scores matching terms higher than non-matching", () => {
    const matching = bm25Score(
      ["auth"],
      ["auth", "login", "user"],
      3,
      new Map([["auth", 1]]),
      1,
    );
    const nonMatching = bm25Score(
      ["banana"],
      ["auth", "login", "user"],
      3,
      new Map([["banana", 1]]),
      1,
    );
    expect(matching).toBeGreaterThan(0);
    expect(nonMatching).toBe(0);
  });

  it("idfs rarer terms higher", () => {
    const rare = bm25Score(
      ["unique"],
      ["unique"],
      1,
      new Map([["unique", 1]]),
      100,
    );
    const common = bm25Score(
      ["common"],
      ["common"],
      1,
      new Map([["common", 50]]),
      100,
    );
    expect(rare).toBeGreaterThan(common);
  });
});

describe("MemoryStore — constructor + close", () => {
  it("creates an in-memory store by default", async () => {
    const s = new MemoryStore();
    expect(s.count()).toBe(0);
    s.close();
  });

  it("creates a persistent store at dbPath", async () => {
    const s1 = new MemoryStore({ dbPath });
    await s1.addChunk({ source: "test.md", role: "fact", text: "hello", project: "p1" });
    s1.close();
    const s2 = new MemoryStore({ dbPath });
    expect(s2.count()).toBe(1);
    s2.close();
  });

  it("survives across store instances on disk", async () => {
    const s1 = new MemoryStore({ dbPath });
    await s1.addChunk({ source: "x.md", role: "fact", text: "alpha", project: "p1" });
    await s1.addChunk({ source: "x.md", role: "fact", text: "beta", project: "p1" });
    s1.close();
    const s2 = new MemoryStore({ dbPath });
    expect(s2.count()).toBe(2);
    s2.close();
  });
});

describe("MemoryStore — addChunk + getChunk", () => {
  it("adds a chunk and returns its id", async () => {
    const s = new MemoryStore();
    const id = await s.addChunk({ source: "a.md", role: "fact", text: "x", project: "p1" });
    expect(id).toBeGreaterThan(0);
    s.close();
  });

  it("round-trips chunk text, source, role, project, ts", async () => {
    const s = new MemoryStore();
    const id = await s.addChunk({
      source: "src",
      role: "decision",
      text: "we chose X",
      project: "p1",
      ts: 12345,
    });
    const c = s.getChunk(id);
    expect(c).not.toBeNull();
    expect(c!.text).toBe("we chose X");
    expect(c!.source).toBe("src");
    expect(c!.role).toBe("decision");
    expect(c!.project).toBe("p1");
    expect(c!.ts).toBe(12345);
    s.close();
  });

  it("defaults ts to Date.now()", async () => {
    const s = new MemoryStore();
    const before = Date.now();
    const id = await s.addChunk({ source: "x", role: "fact", text: "x" });
    const c = s.getChunk(id);
    expect(c!.ts).toBeGreaterThanOrEqual(before);
    s.close();
  });

  it("defaults project to null (global)", async () => {
    const s = new MemoryStore();
    const id = await s.addChunk({ source: "x", role: "fact", text: "x" });
    expect(s.getChunk(id)!.project).toBeNull();
    s.close();
  });

  it("embeds via injected provider when no embedding given", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    const id = await s.addChunk({ source: "x", role: "fact", text: "auth login" });
    const c = s.getChunk(id);
    expect(c!.embedding[0]).toBe(1);
    s.close();
  });

  it("uses provided embedding if given", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    const v = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const id = await s.addChunk({ source: "x", role: "fact", text: "x", embedding: v });
    const back = s.getChunk(id)!.embedding;
    for (let i = 0; i < 4; i++) expect(back[i]).toBeCloseTo(v[i], 5);
    s.close();
  });
});

describe("MemoryStore — addChunks (batch)", () => {
  it("inserts multiple chunks in a single transaction", async () => {
    const s = new MemoryStore();
    const ids = await s.addChunks([
      { source: "a", role: "fact", text: "1" },
      { source: "a", role: "fact", text: "2" },
      { source: "a", role: "fact", text: "3" },
    ]);
    expect(ids).toHaveLength(3);
    expect(s.count()).toBe(3);
    s.close();
  });

  it("returns empty array for empty input", async () => {
    const s = new MemoryStore();
    const ids = await s.addChunks([]);
    expect(ids).toEqual([]);
    expect(s.count()).toBe(0);
    s.close();
  });
});

describe("MemoryStore — deleteChunk / deleteBySource / deleteByProject", () => {
  it("deleteChunk returns true when found, false when not", async () => {
    const s = new MemoryStore();
    const id = await s.addChunk({ source: "x", role: "fact", text: "x" });
    expect(s.deleteChunk(id)).toBe(true);
    expect(s.deleteChunk(id)).toBe(false);
    s.close();
  });

  it("deleteBySource removes all chunks with matching source", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "a.md", role: "fact", text: "1" });
    await s.addChunk({ source: "a.md", role: "fact", text: "2" });
    await s.addChunk({ source: "b.md", role: "fact", text: "3" });
    const removed = s.deleteBySource("a.md");
    expect(removed).toBe(2);
    expect(s.count()).toBe(1);
    s.close();
  });

  it("deleteByProject removes all chunks for project", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "a", role: "fact", text: "1", project: "p1" });
    await s.addChunk({ source: "a", role: "fact", text: "2", project: "p1" });
    await s.addChunk({ source: "a", role: "fact", text: "3", project: "p2" });
    const removed = s.deleteByProject("p1");
    expect(removed).toBe(2);
    expect(s.count()).toBe(1);
    s.close();
  });
});

describe("MemoryStore — count + listSources", () => {
  it("count with project filter", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "a", role: "fact", text: "1", project: "p1" });
    await s.addChunk({ source: "a", role: "fact", text: "2", project: "p2" });
    expect(s.count({ project: "p1" })).toBe(1);
    expect(s.count({ project: "p2" })).toBe(1);
    s.close();
  });

  it("count with role filter", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "a", role: "fact", text: "1" });
    await s.addChunk({ source: "a", role: "decision", text: "2" });
    expect(s.count({ role: "fact" })).toBe(1);
    s.close();
  });

  it("listSources returns distinct sources", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "a.md", role: "fact", text: "1" });
    await s.addChunk({ source: "a.md", role: "fact", text: "2" });
    await s.addChunk({ source: "b.md", role: "fact", text: "3" });
    expect(s.listSources()).toEqual(["a.md", "b.md"]);
    s.close();
  });
});

describe("MemoryStore — query (BM25-only, NullEmbeddings)", () => {
  it("returns empty when no chunks", async () => {
    const s = new MemoryStore();
    const out = await s.query("anything");
    expect(out).toEqual([]);
    s.close();
  });

  it("ranks by BM25 on token match", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "x", role: "fact", text: "authentication login flow" });
    await s.addChunk({ source: "x", role: "fact", text: "database connection pooling" });
    await s.addChunk({ source: "x", role: "fact", text: "user authentication authorization" });
    const out = await s.query("authentication", { k: 2 });
    expect(out).toHaveLength(2);
    expect(out[0].chunk.text).toContain("authentication");
    s.close();
  });

  it("applies project filter", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "x", role: "fact", text: "alpha", project: "p1" });
    await s.addChunk({ source: "x", role: "fact", text: "alpha", project: "p2" });
    const out = await s.query("alpha", { project: "p1" });
    expect(out).toHaveLength(1);
    expect(out[0].chunk.project).toBe("p1");
    s.close();
  });

  it("applies role filter", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "x", role: "fact", text: "alpha" });
    await s.addChunk({ source: "x", role: "decision", text: "alpha" });
    const out = await s.query("alpha", { filterRole: "fact" });
    expect(out).toHaveLength(1);
    expect(out[0].chunk.role).toBe("fact");
    s.close();
  });

  it("applies minScore filter", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "x", role: "fact", text: "alpha" });
    await s.addChunk({ source: "x", role: "fact", text: "unrelated text content" });
    const out = await s.query("alpha", { minScore: 0.99 });
    expect(out.every((r) => r.score >= 0.99)).toBe(true);
    s.close();
  });

  it("returns at most k results", async () => {
    const s = new MemoryStore();
    for (let i = 0; i < 10; i++) {
      await s.addChunk({ source: "x", role: "fact", text: `chunk ${i} alpha` });
    }
    const out = await s.query("alpha", { k: 3 });
    expect(out).toHaveLength(3);
    s.close();
  });

  it("populates sources array with bm25 when match found", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "x", role: "fact", text: "auth login user" });
    const out = await s.query("login", { k: 5 });
    expect(out[0].sources).toContain("bm25");
    s.close();
  });
});

describe("MemoryStore — query (vector + hybrid)", () => {
  it("ranks semantically similar chunks higher", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await s.addChunk({ source: "x", role: "fact", text: "unrelated topic here" });
    await s.addChunk({ source: "x", role: "fact", text: "auth login user account" });
    await s.addChunk({ source: "x", role: "fact", text: "database connection pool" });
    const out = await s.query("login", { k: 3 });
    expect(out[0].chunk.text).toContain("auth login");
    expect(out[0].sources).toContain("vector");
    s.close();
  });

  it("hybrid: combines vector + bm25 when both contribute", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await s.addChunk({ source: "x", role: "fact", text: "auth login flow uses database" });
    const out = await s.query("auth", { k: 5 });
    expect(out[0].sources).toContain("vector");
    expect(out[0].sources).toContain("bm25");
    s.close();
  });

  it("handles provider error gracefully (vector skipped, BM25 still works)", async () => {
    const broken = new FakeEmbeddings();
    broken.embed = () => Promise.reject(new Error("API down"));
    const s = new MemoryStore({ embeddings: broken });
    await s.addChunk({
      source: "x",
      role: "fact",
      text: "auth login",
      embedding: new Float32Array([1, 0, 0, 0]),
    });
    const out = await s.query("auth", { k: 5 });
    expect(out).toHaveLength(1);
    expect(out[0].sources).toContain("bm25");
    s.close();
  });

  it("bm25Weight=1 uses BM25 only (ignores vector)", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await s.addChunk({
      source: "x",
      role: "fact",
      text: "auth",
      embedding: new Float32Array([0, 0, 0, 1]),
    });
    await s.addChunk({ source: "x", role: "fact", text: "auth", embedding: new Float32Array([1, 0, 0, 0]) });
    const out = await s.query("auth", { k: 5, bm25Weight: 1 });
    expect(out).toHaveLength(2);
    expect(out[0].sources).not.toContain("vector");
    s.close();
  });

  it("bm25Weight=0 uses vector only", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await s.addChunk({ source: "x", role: "fact", text: "auth login" });
    const out = await s.query("auth", { k: 5, bm25Weight: 0 });
    expect(out[0].sources).toContain("vector");
    expect(out[0].sources).not.toContain("bm25");
    s.close();
  });

  it("recency boost surfaces recent chunks over old with equal relevance", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    const now = Date.now();
    const old = new Float32Array([1, 0, 0, 0]);
    const recent = new Float32Array([1, 0, 0, 0]);
    await s.addChunk({ source: "x", role: "fact", text: "auth", embedding: old, ts: now - 1000 * 60 * 60 * 24 * 365 });
    await s.addChunk({ source: "x", role: "fact", text: "auth", embedding: recent, ts: now });
    const out = await s.query("auth", { k: 5, bm25Weight: 0, recencyBoost: 0.5 });
    expect(out[0].chunk.id).toBeGreaterThan(out[1].chunk.id);
    s.close();
  });
});

describe("MemoryStore — NullEmbeddings default", () => {
  it("uses NullEmbeddings when no provider given", async () => {
    const s = new MemoryStore();
    expect(s.provider.name).toBe("null");
    s.close();
  });

  it("still works for BM25-only search", async () => {
    const s = new MemoryStore();
    await s.addChunk({ source: "x", role: "fact", text: "alpha" });
    const out = await s.query("alpha");
    expect(out).toHaveLength(1);
    s.close();
  });
});

describe("MemoryStore — indexMarkdown integration", () => {
  it("indexes a markdown file into chunks", async () => {
    const s = new MemoryStore();
    const mdPath = join(dir, "doc.md");
    writeFileSync(mdPath, "# Title\nintro\n\n## Sub\nbody");
    const content = "# Title\nintro\n\n## Sub\nbody";
    const chunks = indexMarkdown(content, { source: "doc.md", role: "narrative" });
    for (const c of chunks) {
      await s.addChunk({ source: c.source, role: c.role, text: c.text });
    }
    expect(s.count()).toBe(chunks.length);
    const out = await s.query("intro");
    expect(out.length).toBeGreaterThan(0);
    s.close();
  });
});

describe("MemoryStore — schema migration", () => {
  it("applies schema_version 1 to fresh db", async () => {
    const s = new MemoryStore({ dbPath });
    s.close();
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath);
    const row = db.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get() as { value: string };
    expect(row.value).toBe("1");
    db.close();
  });

  it("does not re-create tables on existing db", async () => {
    const s1 = new MemoryStore({ dbPath });
    await s1.addChunk({ source: "x", role: "fact", text: "persisted" });
    s1.close();
    const s2 = new MemoryStore({ dbPath });
    expect(s2.count()).toBe(1);
    s2.close();
  });
});

describe("MemoryStore — edge cases", () => {
  it("handles special characters in text", async () => {
    const s = new MemoryStore();
    const id = await s.addChunk({ source: "x", role: "fact", text: "hello 'world' \"test\" \\n\t" });
    expect(s.getChunk(id)!.text).toBe("hello 'world' \"test\" \\n\t");
    s.close();
  });

  it("handles unicode text", async () => {
    const s = new MemoryStore();
    const id = await s.addChunk({ source: "x", role: "fact", text: "héllo wörld 你好 🚀" });
    const out = await s.query("héllo");
    expect(out).toHaveLength(1);
    expect(s.getChunk(id)!.text).toContain("你好");
    s.close();
  });

  it("handles many chunks (1000+) without crashing", async () => {
    const s = new MemoryStore();
    for (let i = 0; i < 1000; i++) {
      await s.addChunk({ source: "bulk", role: "fact", text: `chunk ${i} with content` });
    }
    expect(s.count()).toBe(1000);
    const out = await s.query("content", { k: 10 });
    expect(out).toHaveLength(10);
    s.close();
  });

  it("1000 chunks query completes under 500ms", async () => {
    const s = new MemoryStore({ embeddings: new FakeEmbeddings() });
    for (let i = 0; i < 1000; i++) {
      await s.addChunk({ source: "bulk", role: "fact", text: `chunk ${i} with some unique text` });
    }
    const start = Date.now();
    const out = await s.query("unique", { k: 10 });
    const elapsed = Date.now() - start;
    expect(out).toHaveLength(10);
    expect(elapsed).toBeLessThan(500);
    s.close();
  });
});
