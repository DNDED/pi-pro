import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGrepTool } from "../src/grep.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "promyra-grep-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("@promyra/tools/grep", () => {
  it("finds a line matching the regex", async () => {
    await writeFile(join(workdir, "a.txt"), "alpha\nbeta\ngamma\n", "utf8");
    const grep = createGrepTool({ cwd: workdir });
    const result = await grep.execute({ pattern: "beta" });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].line).toBe("beta");
    expect(result.matches[0].lineNumber).toBe(2);
    expect(result.matches[0].path).toContain("a.txt");
  });

  it("returns an empty array when nothing matches", async () => {
    await writeFile(join(workdir, "a.txt"), "alpha\n", "utf8");
    const grep = createGrepTool({ cwd: workdir });
    const result = await grep.execute({ pattern: "xyz" });
    expect(result.matches).toEqual([]);
  });

  it("is case-sensitive by default", async () => {
    await writeFile(join(workdir, "a.txt"), "Foo\nfoo\nFOO\n", "utf8");
    const grep = createGrepTool({ cwd: workdir });
    const result = await grep.execute({ pattern: "foo" });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].line).toBe("foo");
  });

  it("supports a regex pattern that matches many files", async () => {
    await writeFile(join(workdir, "a.txt"), "match-me here\n", "utf8");
    await writeFile(join(workdir, "b.txt"), "also match-me\n", "utf8");
    await writeFile(join(workdir, "c.txt"), "nope\n", "utf8");
    const grep = createGrepTool({ cwd: workdir });
    const result = await grep.execute({ pattern: "match-me" });
    expect(result.matches).toHaveLength(2);
    const paths = result.matches.map(m => m.path).sort();
    expect(paths).toEqual(["a.txt", "b.txt"]);
  });

  it("skips binary files that fail utf8 read (no throw)", async () => {
    await writeFile(join(workdir, "ok.txt"), "ok-match\n", "utf8");
    // Force an unreadable-as-utf8 binary blob.
    const { writeFile: wf } = await import("node:fs/promises");
    await wf(join(workdir, "blob.bin"), Buffer.from([0xff, 0xfe, 0x00, 0x80, 0x80]));
    const grep = createGrepTool({ cwd: workdir });
    const result = await grep.execute({ pattern: "ok-match" });
    // ok.txt matches; blob.bin is silently skipped rather than throwing.
    expect(result.matches.map(m => m.path)).toEqual(["ok.txt"]);
  });

  it("respects maxDepth and stops at the configured depth", async () => {
    // a/b/c/d.txt — depth 0/1/2/3 from workdir.
    await mkdir(join(workdir, "a/b/c"), { recursive: true });
    await writeFile(join(workdir, "a/b/c/d.txt"), "deep\n", "utf8");
    await writeFile(join(workdir, "shallow.txt"), "deep\n", "utf8");
    const shallow = createGrepTool({ cwd: workdir, maxDepth: 1 });
    const result = await shallow.execute({ pattern: "deep" });
    // Should find shallow.txt only.
    expect(result.matches.map(m => m.path)).toEqual(["shallow.txt"]);
  });

  it("skips ignored directories (node_modules, .git, dist, .promyra)", async () => {
    await writeFile(join(workdir, "keep.txt"), "target\n", "utf8");
    await mkdir(join(workdir, "node_modules"), { recursive: true });
    await writeFile(join(workdir, "node_modules", "leak.txt"), "target\n", "utf8");
    await mkdir(join(workdir, ".git"), { recursive: true });
    await writeFile(join(workdir, ".git", "leak.txt"), "target\n", "utf8");
    await mkdir(join(workdir, "dist"), { recursive: true });
    await writeFile(join(workdir, "dist", "leak.txt"), "target\n", "utf8");
    const grep = createGrepTool({ cwd: workdir });
    const result = await grep.execute({ pattern: "target" });
    expect(result.matches.map(m => m.path)).toEqual(["keep.txt"]);
  });
});
