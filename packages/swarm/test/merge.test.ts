import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { WorktreePool } from "../src/worktree-pool.js";
import { mergeWorktree, MergeResult } from "../src/merge.js";
import { swarmId } from "../src/types.js";

let root: string;
const testId = swarmId("swarm_merge_001");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "promyra-swarm-merge-"));
  execSync("git init -q -b main", { cwd: root });
  execSync("git config user.email t@local", { cwd: root });
  execSync("git config user.name t", { cwd: root });
  await writeFile(join(root, "README.md"), "# Test\n");
  execSync("git add -A && git commit -q -m init", { cwd: root });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function pool(): WorktreePool {
  return new WorktreePool({ rootDir: root, swarmId: testId });
}

describe("mergeWorktree", () => {
  it("merges a clean worktree branch into main", async () => {
    const p = pool();
    const ref = p.createSync("builder");
    await writeFile(join(ref.path, "feature.txt"), "new feature");
    execSync('git add -A && git commit -q -m "add feature"', { cwd: ref.path, shell: "/bin/sh" });

    const result: MergeResult = mergeWorktree({ rootDir: root, swarmId: testId, role: "builder" });
    expect(result.success).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.mergedFiles).toContain("feature.txt");

    // Verify the file is in main
    const content = await readFile(join(root, "feature.txt"), "utf8");
    expect(content).toBe("new feature");
  });

  it("detects conflict when both branches modified same file", async () => {
    // Create worktree FIRST, then modify README in both
    const p = pool();
    const ref = p.createSync("builder");
    await writeFile(join(ref.path, "README.md"), "# builder version");
    execSync('git add -A && git commit -q -m "builder edit"', { cwd: ref.path, shell: "/bin/sh" });

    // Now modify README in main
    await writeFile(join(root, "README.md"), "# main version");
    execSync('git add -A && git commit -q -m "main edit"', { cwd: root, shell: "/bin/sh" });

    const result = mergeWorktree({ rootDir: root, swarmId: testId, role: "builder" });
    expect(result.success).toBe(false);
    expect(result.conflicts).toContain("README.md");
  });

  it("dry-run returns plan without modifying", async () => {
    const p = pool();
    const ref = p.createSync("builder");
    await writeFile(join(ref.path, "feature.txt"), "x");
    execSync('git add -A && git commit -q -m "x"', { cwd: ref.path, shell: "/bin/sh" });

    const result = mergeWorktree({ rootDir: root, swarmId: testId, role: "builder", dryRun: true });
    expect(result.dryRun).toBe(true);
    // File should not be in main yet
    const exists = (await import("node:fs")).existsSync(join(root, "feature.txt"));
    expect(exists).toBe(false);
  });
});

// Need to import readFile (not used above) for the verification
import { readFile } from "node:fs/promises";
