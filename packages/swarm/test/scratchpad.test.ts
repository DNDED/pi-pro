import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Scratchpad } from "../src/scratchpad.js";
import { swarmId } from "../src/types.js";

let root: string;
let pad: Scratchpad;
const testId = swarmId("swarm_test_001");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "promyra-swarm-scratchpad-"));
  pad = new Scratchpad({ baseDir: root, swarmId: testId });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Scratchpad — basic file ops", () => {
  it("writes a text file", async () => {
    await pad.writeFile("plan.md", "# Plan\n\n- step 1\n- step 2");
    const got = await readFile(join(root, "swarm_test_001", "plan.md"), "utf8");
    expect(got).toBe("# Plan\n\n- step 1\n- step 2");
  });

  it("reads a written file", async () => {
    await pad.writeFile("plan.md", "hello world");
    const got = await pad.readFile("plan.md");
    expect(got).toBe("hello world");
  });

  it("readFile throws if file does not exist", async () => {
    await expect(pad.readFile("missing.md")).rejects.toThrow(/not found/i);
  });

  it("exists returns true for written files, false otherwise", async () => {
    await pad.writeFile("plan.md", "x");
    expect(await pad.exists("plan.md")).toBe(true);
    expect(await pad.exists("other.md")).toBe(false);
  });

  it("lists files in the scratchpad", async () => {
    await pad.writeFile("plan.md", "p");
    await pad.writeFile("builder.md", "b");
    await pad.writeFile("critic.md", "c");
    const files = await pad.listFiles();
    expect(files.sort()).toEqual(["builder.md", "critic.md", "plan.md"]);
  });

  it("creates the swarm directory on first write", async () => {
    // root is fresh, no swarm dir yet
    const swarmDir = join(root, "swarm_test_001");
    await pad.writeFile("plan.md", "x");
    const exists = await readdir(swarmDir);
    expect(exists).toContain("plan.md");
  });
});

describe("Scratchpad — JSON ops", () => {
  it("writes and reads a JSON object", async () => {
    await pad.writeJSON("cost.json", { totalUsd: 0.5, bySubagent: { builder: 0.5 } });
    const got = await pad.readJSON<{ totalUsd: number; bySubagent: Record<string, number> }>("cost.json");
    expect(got.totalUsd).toBe(0.5);
    expect(got.bySubagent.builder).toBe(0.5);
  });

  it("JSON read throws on invalid JSON", async () => {
    await pad.writeFile("broken.json", "{ not json");
    await expect(pad.readJSON("broken.json")).rejects.toThrow(/JSON/i);
  });

  it("JSON read throws on missing file", async () => {
    await expect(pad.readJSON("nope.json")).rejects.toThrow(/not found/i);
  });
});

describe("Scratchpad — atomic write", () => {
  it("writeFile does not leave .tmp files on success", async () => {
    await pad.writeFile("plan.md", "content");
    const files = await readdir(join(root, "swarm_test_001"));
    expect(files).toContain("plan.md");
    expect(files.filter(f => f.endsWith(".tmp")).length).toBe(0);
  });

  it("concurrent writes to different files do not corrupt", async () => {
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      writes.push(pad.writeFile(`f${i}.md`, `content-${i}`));
    }
    await Promise.all(writes);
    for (let i = 0; i < 10; i++) {
      const got = await pad.readFile(`f${i}.md`);
      expect(got).toBe(`content-${i}`);
    }
  });

  it("concurrent writes to the same file: last-write-wins, no corruption", async () => {
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      writes.push(pad.writeFile("plan.md", `version-${i}`));
    }
    await Promise.all(writes);
    const got = await pad.readFile("plan.md");
    expect(got).toMatch(/^version-\d+$/);
  });
});

describe("Scratchpad — cost.json append-friendly", () => {
  it("mergeJSON merges new fields into existing object", async () => {
    await pad.writeJSON("cost.json", { totalUsd: 0.5, bySubagent: { builder: 0.5 } });
    await pad.mergeJSON("cost.json", { bySubagent: { planner: 0.1 } });
    const got = await pad.readJSON<{ totalUsd: number; bySubagent: Record<string, number> }>("cost.json");
    expect(got.totalUsd).toBe(0.5);
    expect(got.bySubagent.builder).toBe(0.5);
    expect(got.bySubagent.planner).toBe(0.1);
  });

  it("mergeJSON treats missing file as empty object", async () => {
    await pad.mergeJSON("cost.json", { totalUsd: 0.1 });
    const got = await pad.readJSON<{ totalUsd: number }>("cost.json");
    expect(got.totalUsd).toBe(0.1);
  });
});

describe("Scratchpad — delete", () => {
  it("deleteFile removes a file", async () => {
    await pad.writeFile("plan.md", "x");
    await pad.deleteFile("plan.md");
    expect(await pad.exists("plan.md")).toBe(false);
  });

  it("deleteFile on non-existent file is a no-op", async () => {
    await expect(pad.deleteFile("nope.md")).resolves.toBeUndefined();
  });
});

describe("Scratchpad — path safety", () => {
  it("rejects path traversal in filename", async () => {
    await expect(pad.writeFile("../escape.md", "x")).rejects.toThrow(/traversal|invalid/i);
  });

  it("rejects absolute paths", async () => {
    await expect(pad.writeFile("/etc/passwd", "x")).rejects.toThrow(/absolute|invalid/i);
  });

  it("rejects filenames with slashes", async () => {
    await expect(pad.writeFile("a/b.md", "x")).rejects.toThrow(/slash|invalid/i);
  });
});
