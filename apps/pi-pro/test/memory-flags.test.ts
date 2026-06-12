import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpHome: string;
beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "pi-pro-cli-test-"));
  process.env.PROMYRA_HOME_OVERRIDE = tmpHome;
  mkdirSync(join(tmpHome, ".pi-pro"), { recursive: true });
  vi.resetModules();
});
afterEach(() => {
  delete process.env.PROMYRA_HOME_OVERRIDE;
  vi.resetModules();
  rmSync(tmpHome, { recursive: true, force: true });
});

describe("pi memory CLI", () => {
  it("memoryAdd returns id + source", async () => {
    const { memoryAdd } = await import("../src/commands/memory.js");
    const { id, source } = await memoryAdd("user prefers dark mode", { role: "preference" });
    expect(id).toBeGreaterThan(0);
    expect(source).toMatch(/^cli:/);
  });

  it("memorySearch returns matching chunks", async () => {
    const { memoryAdd, memorySearch, formatMemoryResults } = await import("../src/commands/memory.js");
    await memoryAdd("user prefers dark mode", { role: "preference", source: "user-prefs" });
    await memoryAdd("system uses SQLite for memory", { role: "fact", source: "design-notes" });
    const results = await memorySearch("dark mode");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain("dark mode");
    const formatted = formatMemoryResults(results);
    expect(formatted).toContain("dark mode");
  });

  it("memoryList returns distinct sources", async () => {
    const { memoryAdd, memoryList } = await import("../src/commands/memory.js");
    await memoryAdd("first", { source: "src-a" });
    await memoryAdd("second", { source: "src-b" });
    const sources = memoryList();
    const names = sources.map(s => s.source);
    expect(names).toContain("src-a");
    expect(names).toContain("src-b");
  });

  it("memoryForget removes by source", async () => {
    const { memoryAdd, memoryForget } = await import("../src/commands/memory.js");
    await memoryAdd("x", { source: "to-forget" });
    await memoryAdd("y", { source: "to-keep" });
    const removed = memoryForget("to-forget");
    expect(removed).toBe(1);
  });

  it("memoryCount returns total", async () => {
    const { memoryAdd, memoryCount } = await import("../src/commands/memory.js");
    expect(memoryCount()).toBe(0);
    await memoryAdd("one");
    await memoryAdd("two");
    expect(memoryCount()).toBe(2);
  });

  it("memoryCount with project filter", async () => {
    const { memoryAdd, memoryCount } = await import("../src/commands/memory.js");
    await memoryAdd("a", { project: "p1" });
    await memoryAdd("b", { project: "p1" });
    await memoryAdd("c", { project: "p2" });
    expect(memoryCount({ project: "p1" })).toBe(2);
    expect(memoryCount({ project: "p2" })).toBe(1);
  });

  it("memorySearch with k limit", async () => {
    const { memoryAdd, memorySearch } = await import("../src/commands/memory.js");
    for (let i = 0; i < 10; i++) await memoryAdd(`alpha chunk ${i}`);
    const results = await memorySearch("alpha", { k: 3 });
    expect(results.length).toBe(3);
  });

  it("formatMemoryResults handles empty", async () => {
    const { formatMemoryResults } = await import("../src/commands/memory.js");
    expect(formatMemoryResults([])).toContain("no results");
  });

  it("formatMemoryResults includes score, source, role", async () => {
    const { memoryAdd, memorySearch, formatMemoryResults } = await import("../src/commands/memory.js");
    await memoryAdd("hello world", { role: "fact", source: "test" });
    const results = await memorySearch("hello");
    const formatted = formatMemoryResults(results);
    expect(formatted).toContain("%");
    expect(formatted).toContain("test");
    expect(formatted).toContain("fact");
  });
});

describe("pi flags (v0.7.0)", () => {
  it("readContextFlagsFromEnv defaults", async () => {
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    const flags = readContextFlagsFromEnv();
    expect(flags.memory).toBe(true);
    expect(flags.compression).toBe("hybrid");
    expect(flags.embeddings).toBe("openai");
    expect(flags.memoryQueryK).toBe(20);
    expect(flags.softWarn).toBe(0.75);
    expect(flags.hardTrigger).toBe(0.90);
  });

  it("readContextFlagsFromEnv reads PROMYRA_MEMORY=0", async () => {
    process.env.PROMYRA_MEMORY = "0";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().memory).toBe(false);
  });

  it("readContextFlagsFromEnv reads PROMYRA_COMPRESSION", async () => {
    process.env.PROMYRA_COMPRESSION = "extractive";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().compression).toBe("extractive");
  });

  it("readContextFlagsFromEnv falls back to hybrid on invalid compression", async () => {
    process.env.PROMYRA_COMPRESSION = "garbage";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().compression).toBe("hybrid");
  });

  it("readContextFlagsFromEnv reads PROMYRA_EMBEDDINGS", async () => {
    process.env.PROMYRA_EMBEDDINGS = "anthropic";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().embeddings).toBe("anthropic");
  });

  it("readContextFlagsFromEnv reads PROMYRA_MEMORY_QUERY_K", async () => {
    process.env.PROMYRA_MEMORY_QUERY_K = "50";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().memoryQueryK).toBe(50);
  });

  it("readContextFlagsFromEnv reads PROMYRA_SOFT_WARN", async () => {
    process.env.PROMYRA_SOFT_WARN = "0.5";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().softWarn).toBe(0.5);
  });

  it("readContextFlagsFromEnv reads PROMYRA_HARD_TRIGGER", async () => {
    process.env.PROMYRA_HARD_TRIGGER = "0.95";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().hardTrigger).toBe(0.95);
  });

  it("readContextFlagsFromEnv falls back on NaN", async () => {
    process.env.PROMYRA_SOFT_WARN = "not-a-number";
    const { readContextFlagsFromEnv } = await import("../src/flags.js");
    expect(readContextFlagsFromEnv().softWarn).toBe(0.75);
  });

  it("formatContextFlagsStatus includes all 6 flags", async () => {
    const { readContextFlagsFromEnv, formatContextFlagsStatus } = await import("../src/flags.js");
    const status = formatContextFlagsStatus(readContextFlagsFromEnv());
    expect(status).toContain("memory:");
    expect(status).toContain("compression:");
    expect(status).toContain("embeddings:");
    expect(status).toContain("memoryQueryK:");
    expect(status).toContain("softWarn:");
    expect(status).toContain("hardTrigger:");
  });

  it("readFlagsFromEnv still works (v0.5.0 back-compat)", async () => {
    const { readFlagsFromEnv } = await import("../src/flags.js");
    const flags = readFlagsFromEnv();
    expect(flags.cache).toBe(true);
    expect(flags.repoMap).toBe(true);
    expect(flags.cascade).toBe(true);
    expect(flags.parallelTools).toBe(true);
    expect(flags.telemetry).toBe(true);
  });
});
