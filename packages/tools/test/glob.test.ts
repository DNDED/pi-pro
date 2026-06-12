import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGlobTool } from "../src/glob.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "promyra-glob-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("@promyra/tools/glob", () => {
  it("returns files matching *.ts", async () => {
    await writeFile(join(workdir, "a.ts"), "", "utf8");
    await writeFile(join(workdir, "b.ts"), "", "utf8");
    await writeFile(join(workdir, "c.txt"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "*.ts" });
    expect(result.files.sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("returns files matching **/*.js across subdirs", async () => {
    await mkdir(join(workdir, "lib"), { recursive: true });
    await writeFile(join(workdir, "lib", "x.js"), "", "utf8");
    await writeFile(join(workdir, "lib", "y.js"), "", "utf8");
    await writeFile(join(workdir, "lib", "skip.ts"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "**/*.js" });
    expect(result.files.sort()).toEqual(["lib/x.js", "lib/y.js"]);
  });

  it("matches ? single-character wildcards", async () => {
    await writeFile(join(workdir, "a1.ts"), "", "utf8");
    await writeFile(join(workdir, "a12.ts"), "", "utf8");
    await writeFile(join(workdir, "b1.ts"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "a?.ts" });
    expect(result.files.sort()).toEqual(["a1.ts"]);
  });

  it("matches [abc] character class brackets", async () => {
    await writeFile(join(workdir, "a.ts"), "", "utf8");
    await writeFile(join(workdir, "b.ts"), "", "utf8");
    await writeFile(join(workdir, "c.ts"), "", "utf8");
    await writeFile(join(workdir, "d.ts"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "[abc].ts" });
    expect(result.files.sort()).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("expands brace patterns like *.{ts,tsx}", async () => {
    await writeFile(join(workdir, "a.ts"), "", "utf8");
    await writeFile(join(workdir, "b.tsx"), "", "utf8");
    await writeFile(join(workdir, "c.js"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "*.{ts,tsx}" });
    expect(result.files.sort()).toEqual(["a.ts", "b.tsx"]);
  });

  it("is case-sensitive on case-sensitive filesystems", async () => {
    await writeFile(join(workdir, "Foo.TS"), "", "utf8");
    await writeFile(join(workdir, "foo.ts"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "*.ts" });
    expect(result.files).toEqual(["foo.ts"]);
  });

  it("matches dotfiles when dot option is enabled", async () => {
    await writeFile(join(workdir, ".hidden.ts"), "", "utf8");
    await writeFile(join(workdir, "visible.ts"), "", "utf8");
    const dot = createGlobTool({ cwd: workdir, dot: true });
    const noDot = createGlobTool({ cwd: workdir });
    const dotResult = await dot.execute({ pattern: "*.ts" });
    expect(dotResult.files.sort()).toEqual([".hidden.ts", "visible.ts"]);
    const noDotResult = await noDot.execute({ pattern: "*.ts" });
    expect(noDotResult.files).toEqual(["visible.ts"]);
  });

  it("returns an empty array when nothing matches", async () => {
    await writeFile(join(workdir, "a.ts"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "*.py" });
    expect(result.files).toEqual([]);
  });

  it("ignores node_modules, .git, dist, and .promyra directories", async () => {
    await writeFile(join(workdir, "keep.ts"), "", "utf8");
    await mkdir(join(workdir, "node_modules"), { recursive: true });
    await writeFile(join(workdir, "node_modules", "leak.ts"), "", "utf8");
    await mkdir(join(workdir, ".git"), { recursive: true });
    await writeFile(join(workdir, ".git", "leak.ts"), "", "utf8");
    await mkdir(join(workdir, "dist"), { recursive: true });
    await writeFile(join(workdir, "dist", "leak.ts"), "", "utf8");
    await mkdir(join(workdir, ".promyra"), { recursive: true });
    await writeFile(join(workdir, ".promyra", "leak.ts"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "*.ts" });
    expect(result.files).toEqual(["keep.ts"]);
  });

  it("respects maxDepth and skips files deeper than the limit", async () => {
    // depth 0/1/2/3 from workdir.
    await mkdir(join(workdir, "a/b/c"), { recursive: true });
    await writeFile(join(workdir, "a", "x.ts"), "", "utf8");
    await writeFile(join(workdir, "a/b", "y.ts"), "", "utf8");
    await writeFile(join(workdir, "a/b/c", "z.ts"), "", "utf8");
    const shallow = createGlobTool({ cwd: workdir, maxDepth: 1 });
    const result = await shallow.execute({ pattern: "**/*.ts" });
    // a/x.ts is at depth 1, b/y.ts is at depth 2 — excluded.
    expect(result.files.sort()).toEqual(["a/x.ts"]);
  });

  it("does not match a file literally named 'ts' when pattern is '*.ts'", async () => {
    await writeFile(join(workdir, "foo.ts"), "", "utf8");
    await writeFile(join(workdir, "bar.ts"), "", "utf8");
    await writeFile(join(workdir, "ts"), "", "utf8");
    const glob = createGlobTool({ cwd: workdir });
    const result = await glob.execute({ pattern: "*.ts" });
    expect(result.files.sort()).toEqual(["bar.ts", "foo.ts"]);
  });
});
