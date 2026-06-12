import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionMemory } from "../src/session-memory.js";

let dir: string;
let mem: SessionMemory;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memory-test-"));
  mem = new SessionMemory(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("@promyra/memory", () => {
  it("returns empty string when no memory file exists", async () => {
    expect(await mem.read()).toBe("");
  });

  it("writes and reads back", async () => {
    await mem.write("# Project Memory\n\n## Context (2026-06-09)\n\nfirst context\n");
    const got = await mem.read();
    expect(got).toContain("first context");
  });

  it("appends a learning with timestamp", async () => {
    await mem.appendLearning({ ts: "2026-06-09T01:00:00Z", source: "summarize", body: "Learned X" });
    const got = await mem.read();
    expect(got).toContain("## Learning (2026-06-09T01:00:00Z)");
    expect(got).toContain("Learned X");
  });

  it("parses learnings back out", async () => {
    await mem.appendLearning({ ts: "2026-06-09T01:00:00Z", source: "summarize", body: "L1" });
    await mem.appendLearning({ ts: "2026-06-09T02:00:00Z", source: "summarize", body: "L2" });
    const got = await mem.getLearnings();
    expect(got).toHaveLength(2);
    expect(got[0].body).toBe("L1");
    expect(got[1].body).toBe("L2");
  });

  it("clears memory", async () => {
    await mem.write("junk");
    await mem.clear();
    expect(await mem.read()).toBe("");
  });
});
