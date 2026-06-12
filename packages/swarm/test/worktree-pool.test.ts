import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { WorktreePool } from "../src/worktree-pool.js";
import { swarmId, type SwarmRole } from "../src/types.js";

let root: string;
const testId = swarmId("swarm_wt_001");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "promyra-swarm-worktree-"));
  // Initialize a git repo
  execSync("git init -q -b main", { cwd: root });
  execSync("git config user.email t@local", { cwd: root });
  execSync("git config user.name t", { cwd: root });
  // Need an initial commit so worktrees can branch from it
  await writeFile(join(root, ".gitkeep"), "");
  execSync("git add -A && git commit -q -m init", { cwd: root });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function pool(): WorktreePool {
  return new WorktreePool({ rootDir: root, swarmId: testId });
}

describe("WorktreePool — create", () => {
  it("creates a worktree for a role", () => {
    const p = pool();
    const ref = p.createSync("builder");
    expect(ref.role).toBe("builder");
    expect(ref.path).toBe(join(root, ".promyra", "worktrees", "swarm_wt_001", "builder"));
    expect(ref.branch).toBe("swarm/swarm_wt_001/builder");
    expect(ref.swarmId).toBe(testId);
  });

  it("the worktree directory exists after create", () => {
    const p = pool();
    const ref = p.createSync("builder");
    // The worktree's .git should point back to the main repo
    const gitFile = join(ref.path, ".git");
    // fs.existsSync not available async, but statSync works
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require("node:fs");
    expect(existsSync(gitFile)).toBe(true);
  });

  it("fails if root is not a git repo", async () => {
    const nonGit = await mkdtemp(join(tmpdir(), "promyra-non-git-"));
    try {
      const p = new WorktreePool({ rootDir: nonGit, swarmId: testId });
      expect(() => p.createSync("builder")).toThrow(/git/i);
    } finally {
      await rm(nonGit, { recursive: true, force: true });
    }
  });

  it("fails if branch already exists", () => {
    const p = pool();
    p.createSync("builder");
    // Trying to create a second worktree on the same branch should fail
    // (or we can re-use by passing force option).
    // Without force, it should fail.
    const p2 = pool();
    expect(() => p2.createSync("builder")).toThrow();
  });
});

describe("WorktreePool — list", () => {
  it("returns empty list before any creates", () => {
    const p = pool();
    expect(p.list()).toEqual([]);
  });

  it("returns all created worktrees", () => {
    const p = pool();
    p.createSync("builder");
    p.createSync("test-runner");
    const list = p.list();
    expect(list).toHaveLength(2);
    expect(list.map(r => r.role).sort()).toEqual(["builder", "test-runner"]);
  });
});

describe("WorktreePool — remove", () => {
  it("removes a worktree", () => {
    const p = pool();
    p.createSync("builder");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require("node:fs");
    expect(existsSync(join(root, ".promyra", "worktrees", "swarm_wt_001", "builder"))).toBe(true);
    p.removeSync("builder");
    expect(existsSync(join(root, ".promyra", "worktrees", "swarm_wt_001", "builder"))).toBe(false);
  });

  it("remove on non-existent is a no-op", () => {
    const p = pool();
    expect(() => p.removeSync("builder")).not.toThrow();
  });

  it("remove deletes the branch", () => {
    const p = pool();
    p.createSync("builder");
    p.removeSync("builder");
    // The branch should be gone
    let out = "";
    try {
      out = execSync("git branch --list swarm/swarm_wt_001/builder", { cwd: root, encoding: "utf8" });
    } catch {
      // git may complain if no commits on the branch
      out = "";
    }
    expect(out.trim()).toBe("");
  });
});

describe("WorktreePool — isolation", () => {
  it("writes in worktree A don't appear in worktree B", async () => {
    const p = pool();
    const a = p.createSync("builder");
    const b = p.createSync("test-runner");
    // Write a file in worktree A
    await writeFile(join(a.path, "hello.txt"), "from A");
    // Worktree B should not see it
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require("node:fs");
    expect(existsSync(join(b.path, "hello.txt"))).toBe(false);
    // And vice versa
    await writeFile(join(b.path, "from_b.txt"), "B");
    expect(existsSync(join(a.path, "from_b.txt"))).toBe(false);
  });
});
