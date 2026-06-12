/**
 * v0.6.0 WorktreePool.
 *
 * Manages per-role git worktrees under `.promyra/worktrees/<swarmId>/<role>/`.
 * Each worktree lives on its own branch `swarm/<swarmId>/<role>`. Builder
 * and test-runner get worktrees (write-capable roles that need isolation).
 * Planner/researcher/critic operate on cwd and don't use this pool.
 *
 * Why git worktrees vs file copies: worktrees share the .git objects, so
 * they're cheap to create and tear down, and they support real `git diff`,
 * `git merge`, and branch-based workflows.
 *
 * All public methods are sync (use execSync). The orchestrator calls
 * them between async LLM dispatches, so blocking is fine.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SwarmId, SwarmRole, WorktreeRef } from "./types.js";

export interface WorktreePoolOpts {
  rootDir: string;
  swarmId: SwarmId;
  /** Override the default worktree base. Default: <rootDir>/.promyra/worktrees */
  baseDir?: string;
}

function git(cwd: string, args: string[]): string {
  return execSync(`git ${args.join(" ")}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export class WorktreePool {
  private readonly rootDir: string;
  private readonly swarmId: SwarmId;
  private readonly baseDir: string;

  constructor(opts: WorktreePoolOpts) {
    this.rootDir = opts.rootDir;
    this.swarmId = opts.swarmId;
    this.baseDir = opts.baseDir ?? join(opts.rootDir, ".promyra", "worktrees");
  }

  /** Path to the worktree for the given role. */
  pathFor(role: SwarmRole): string {
    return join(this.baseDir, this.swarmId, role);
  }

  /** Branch name for the given role. */
  branchFor(role: SwarmRole): string {
    return `swarm/${this.swarmId}/${role}`;
  }

  private assertGitRepo(): void {
    if (!existsSync(join(this.rootDir, ".git"))) {
      throw new Error(`WorktreePool: ${this.rootDir} is not a git repository`);
    }
  }

  /**
   * Create a worktree + branch for the given role. Sync.
   * Throws if the branch already exists.
   */
  createSync(role: SwarmRole): WorktreeRef {
    this.assertGitRepo();
    const path = this.pathFor(role);
    const branch = this.branchFor(role);
    // Create branch from current HEAD, then check it out as a worktree
    git(this.rootDir, ["worktree", "add", "-b", branch, path]);
    return { role, path, branch, swarmId: this.swarmId };
  }

  /**
   * Remove a worktree + delete its branch. Idempotent — no-op if the
   * worktree doesn't exist.
   */
  removeSync(role: SwarmRole): void {
    const path = this.pathFor(role);
    const branch = this.branchFor(role);
    if (existsSync(path)) {
      try {
        git(this.rootDir, ["worktree", "remove", "--force", path]);
      } catch {
        // If git worktree remove fails, try prune + manual rm
        try { git(this.rootDir, ["worktree", "prune"]); } catch {}
      }
    }
    // Delete the branch (ignore errors — branch may not exist)
    try {
      git(this.rootDir, ["branch", "-D", branch]);
    } catch {
      // branch already gone
    }
  }

  /** List all worktrees created for this swarm. */
  list(): WorktreeRef[] {
    const out: WorktreeRef[] = [];
    for (const role of ["builder", "test-runner"] as SwarmRole[]) {
      const path = this.pathFor(role);
      if (existsSync(path)) {
        out.push({ role, path, branch: this.branchFor(role), swarmId: this.swarmId });
      }
    }
    return out;
  }

  /**
   * Merge a worktree's branch into the target branch. Sync. Returns
   * `{ success: true, changedFiles }` on success, or
   * `{ success: false, conflicts }` on conflict. `changedFiles` is
   * captured BEFORE the merge (3-dot diff) since the merge makes the
   * branches equal.
   */
  mergeSync(role: SwarmRole, targetBranch: string = "main"): { success: boolean; conflicts: string[]; changedFiles: string[]; error?: string } {
    const branch = this.branchFor(role);
    // Capture changed files BEFORE merge (3-dot diff: branch vs target)
    let changedFiles: string[] = [];
    try {
      const out = git(this.rootDir, ["diff", "--name-only", `${targetBranch}...${branch}`]);
      changedFiles = out.split("\n").map(s => s.trim()).filter(Boolean);
    } catch {
      changedFiles = [];
    }
    try {
      // After `git worktree add`, the main repo's HEAD is detached.
      // Make sure we're on the target branch before merging.
      try {
        git(this.rootDir, ["checkout", targetBranch]);
      } catch {
        // Already on targetBranch or detached HEAD is fine
      }
      // Quote the merge message so spaces don't get split into args.
      const msg = `swarm-merge-${role}-worktree`;
      git(this.rootDir, ["merge", "--no-ff", branch, "-m", msg]);
      return { success: true, conflicts: [], changedFiles };
    } catch (e) {
      // Conflict — extract conflicted files
      const conflicts: string[] = [];
      try {
        const status = git(this.rootDir, ["diff", "--name-only", "--diff-filter=U"]);
        conflicts.push(...status.split("\n").filter(s => s.trim()));
      } catch {}
      try {
        git(this.rootDir, ["merge", "--abort"]);
      } catch {}
      return {
        success: false,
        conflicts,
        changedFiles,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
