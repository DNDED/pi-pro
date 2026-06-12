/**
 * v0.6.0 merge.
 *
 * Wraps `WorktreePool.mergeSync` with a higher-level API: takes a
 * swarmId + role, finds the worktree, merges into the target branch.
 * Returns rich MergeResult for the orchestrator to decide next steps.
 */

import { execSync } from "node:child_process";
import { WorktreePool } from "./worktree-pool.js";
import type { SwarmId, SwarmRole } from "./types.js";

export interface MergeOpts {
  rootDir: string;
  swarmId: SwarmId;
  role: SwarmRole;
  targetBranch?: string;
  dryRun?: boolean;
}

export interface MergeResult {
  success: boolean;
  conflicts: string[];
  mergedFiles: string[];
  dryRun: boolean;
  error?: string;
}

export function mergeWorktree(opts: MergeOpts): MergeResult {
  const pool = new WorktreePool({ rootDir: opts.rootDir, swarmId: opts.swarmId });
  const target = opts.targetBranch ?? "main";
  const dryRun = opts.dryRun ?? false;

  if (dryRun) {
    // Plan only — show what would happen
    const files = changedFiles(opts.rootDir, pool.branchFor(opts.role), target);
    return { success: true, conflicts: [], mergedFiles: files, dryRun: true };
  }

  const result = pool.mergeSync(opts.role, target);
  if (result.success) {
    return { success: true, conflicts: [], mergedFiles: result.changedFiles, dryRun: false };
  }
  return {
    success: false,
    conflicts: result.conflicts,
    mergedFiles: result.changedFiles,
    dryRun: false,
    error: result.error,
  };
}

/** Files changed on `branch` since `target`. */
function changedFiles(rootDir: string, branch: string, target: string): string[] {
  try {
    // Three-dot diff: files changed on branch since target.
    const out = execSync(`git diff --name-only ${target}...${branch}`, {
      cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return out.split("\n").map(s => s.trim()).filter(Boolean);
  } catch {
    // Fallback: try two-dot diff (branch vs target HEAD)
    try {
      const out = execSync(`git diff --name-only ${target} ${branch}`, {
        cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
      return out.split("\n").map(s => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}
