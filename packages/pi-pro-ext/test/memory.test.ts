import { describe, it, expect, afterEach } from "vitest";
import { addMemory, searchMemory, listMemory, clearMemory, loadMemoryState, type MemoryState } from "../src/memory.js";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let dirs: string[] = [];
function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), `pi-pro-mem-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("addMemory", () => {
  it("appends an entry and returns new state", () => {
    const path = join(tmpDir(), "memory.jsonl");
    const r1 = addMemory({ entries: [], nextId: 1 }, "first", "fact", "proj-x", path);
    const r2 = addMemory(r1.state, "second", "decision", "proj-x", path);
    expect(r1.entry.text).toBe("first");
    expect(r1.entry.role).toBe("fact");
    expect(r1.entry.project).toBe("proj-x");
    expect(r2.state.entries.length).toBe(2);
    expect(r2.state.nextId).toBe(3);
  });

  it("trims text", () => {
    const path = join(tmpDir(), "memory.jsonl");
    const r = addMemory({ entries: [], nextId: 1 }, "  trim me  ", "narrative", undefined, path);
    expect(r.entry.text).toBe("trim me");
  });
});

describe("searchMemory", () => {
  it("matches substring", () => {
    const state: MemoryState = {
      entries: [
        { ts: 1, role: "fact", text: "the auth flow uses JWT", source: "s1" },
        { ts: 2, role: "fact", text: "rate limit is 100 req/s", source: "s2" },
        { ts: 3, role: "fact", text: "auth login uses bcrypt", source: "s3" },
      ],
      nextId: 4,
    };
    const r = searchMemory(state, "auth");
    expect(r.length).toBe(2);
    expect(r[0]?.text).toContain("auth");
  });

  it("returns empty for empty query", () => {
    expect(searchMemory({ entries: [], nextId: 1 }, "")).toEqual([]);
  });

  it("respects k limit", () => {
    const state: MemoryState = {
      entries: Array.from({ length: 10 }, (_, i) => ({
        ts: i + 1, role: "fact" as const, text: `match foo ${i}`, source: `s${i}`,
      })),
      nextId: 11,
    };
    expect(searchMemory(state, "foo", 3).length).toBe(3);
  });
});

describe("listMemory", () => {
  it("returns sorted by ts desc", () => {
    const state: MemoryState = {
      entries: [
        { ts: 1, role: "fact", text: "old", source: "s1" },
        { ts: 2, role: "fact", text: "new", source: "s2" },
      ],
      nextId: 3,
    };
    const r = listMemory(state);
    expect(r[0]?.text).toBe("new");
    expect(r[1]?.text).toBe("old");
  });
});

describe("clearMemory", () => {
  it("resets to empty", () => {
    const r = clearMemory({ entries: [{ ts: 1, role: "fact", text: "x", source: "s" }], nextId: 2 });
    expect(r.entries).toEqual([]);
    expect(r.nextId).toBe(1);
  });
});

describe("loadMemoryState", () => {
  it("returns empty for missing file", () => {
    const state = loadMemoryState(join(tmpDir(), "missing.jsonl"));
    expect(state.entries).toEqual([]);
  });

  it("reads existing JSONL", () => {
    const path = join(tmpDir(), "mem.jsonl");
    writeFileSync(path, JSON.stringify({ ts: 1, role: "fact", text: "x", source: "s" }) + "\n");
    const state = loadMemoryState(path);
    expect(state.entries.length).toBe(1);
    expect(state.nextId).toBe(2);
  });
});
