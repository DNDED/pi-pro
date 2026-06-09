import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { TaskRunner } from "../src/task-runner.js";
import { CheckpointStore } from "@pi/checkpoint";
import { SessionMemory } from "@pi/memory";
import { SessionLog } from "../src/session-log.js";
import { WorktreeStore } from "../src/worktree-store.js";
import { Plan } from "../src/types.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tasks-runner-retry-"));
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email t@local", { cwd: dir });
  execSync("git config user.name t", { cwd: dir });
  execSync("git commit --allow-empty -q -m init", { cwd: dir });
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("TaskRunner — retry on checkpoint failure", () => {
  it("retries checkpoint writes up to N times before throwing", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "x", steps: [] };
    const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree }, { checkpointRetries: 3 });

    let attempts = 0;
    const spy = vi.spyOn(checkpoint, "snapshot").mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error("disk full");
      return {
        id: "chk_000001",
        taskId,
        state: "intake",
        gitTreeSha: "x",
        createdAt: new Date().toISOString(),
        payload: {},
      } as never;
    });

    await runner.intake();
    expect(attempts).toBe(3);
    spy.mockRestore();
  });

  it("throws after all retries are exhausted", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "x", steps: [] };
    const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree }, { checkpointRetries: 2 });

    const spy = vi.spyOn(checkpoint, "snapshot").mockRejectedValue(new Error("EIO"));

    await expect(runner.intake()).rejects.toThrow(/Checkpoint write failed after 2 attempts/);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
