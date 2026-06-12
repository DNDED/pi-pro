import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { TaskRunner } from "../src/task-runner.js";
import { CheckpointStore } from "@promyra/checkpoint";
import { SessionMemory } from "@promyra/memory";
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

  it("two TaskRunner instances on the same task produce non-overlapping chk ids", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "shared", steps: [] };

    const r1 = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await r1.intake();
    const after1 = await checkpoint.listForTask(taskId);
    expect(after1.length).toBe(1);
    expect(after1[0].id).toBe("chk_000001");

    const r2 = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await r2.intake();
    const after2 = await checkpoint.listForTask(taskId);
    expect(after2.length).toBe(2);
    const ids = after2.map(c => c.id).sort();
    expect(ids).toEqual(["chk_000001", "chk_000002"]);
  });

  it("continues seq after a mid-task resume from the latest checkpoint", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "resume", steps: [] };

    const r1 = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await r1.intake();
    await r1.branch();
    expect((await checkpoint.latest(taskId))?.id).toBe("chk_000003");

    const r2 = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await r2.markStepDone("nonexistent").catch(() => {});
    const ids = (await checkpoint.listForTask(taskId)).map(c => c.id);
    // r2 doesn't write a checkpoint for markStepDone (no transition), so latest should still be 000003.
    expect(ids).toEqual(["chk_000001", "chk_000002", "chk_000003"]);
  });
});

describe("TaskRunner — verify and summarize transitions", () => {
  it("markVerifyPass transitions to summarize", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "v", steps: [] };
    const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await runner.intake();
    await runner.branch();
    expect(runner.state()).toBe("execute");
    await runner.markVerifyPass();
    expect(runner.state()).toBe("summarize");
  });

  it("markVerifyFail transitions back to execute with the reason in the payload", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "v", steps: [] };
    const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await runner.intake();
    await runner.branch();
    await runner.markVerifyFail("tests failing on test_foo");
    expect(runner.state()).toBe("execute");
    const latest = await checkpoint.latest(taskId);
    expect(latest?.payload).toMatchObject({ verify: "fail", reason: "tests failing on test_foo" });
  });

  it("summarize() writes to memory AND transitions to done", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "sm", steps: [] };
    const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await runner.intake();
    await runner.branch();
    await runner.markVerifyPass();
    expect(runner.state()).toBe("summarize");
    await runner.summarize("PR description here");
    expect(runner.state()).toBe("done");
    const memRaw = await memory.read();
    expect(memRaw).toContain("PR description here");
    const latest = await checkpoint.latest(taskId);
    expect(latest?.state).toBe("done");
  });
});
