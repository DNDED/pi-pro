import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateMachine, canTransition, nextStates, TRANSITIONS } from "../src/state-machine.js";
import { Plan, TaskRunner } from "../src/index.js";
import { CheckpointStore } from "@pi/checkpoint";
import { SessionMemory } from "@pi/memory";
import { SessionLog } from "../src/session-log.js";
import { WorktreeStore } from "../src/worktree-store.js";
import { execSync } from "node:child_process";

describe("@pi/tasks state machine", () => {
  it("starts at intake", () => {
    const sm = new StateMachine();
    expect(sm.state()).toBe("intake");
  });

  it("allows intake -> plan", () => {
    expect(canTransition("intake", "plan")).toBe(true);
  });

  it("rejects intake -> execute (skips plan)", () => {
    expect(canTransition("intake", "execute")).toBe(false);
  });

  it("rejects done -> anything", () => {
    expect(nextStates("done")).toEqual([]);
  });

  it("executes the state transitions list", () => {
    expect(TRANSITIONS.length).toBeGreaterThan(0);
  });

  it("StateMachine steps advance in order", () => {
    const plan: Plan = {
      taskId: "tsk_abc",
      title: "x",
      steps: [
        { id: "s1", description: "first", done: false },
        { id: "s2", description: "second", done: false },
      ],
    };
    const sm = new StateMachine();
    expect(sm.nextStep(plan)?.id).toBe("s1");
    const p1 = sm.markStepDone("s1", plan);
    expect(sm.nextStep(p1)?.id).toBe("s2");
    const p2 = sm.markStepDone("s2", p1);
    expect(sm.nextStep(p2)).toBeNull();
    expect(sm.isComplete(p2)).toBe(true);
  });
});

describe("TaskRunner end-to-end", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "tasks-runner-"));
    execSync("git init -q", { cwd: dir });
    execSync("git config user.email test@local", { cwd: dir });
    execSync("git config user.name test", { cwd: dir });
    execSync("git commit --allow-empty -q -m init", { cwd: dir });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("drives a full task through all states", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "smoke", steps: [
      { id: "a", description: "first", done: false },
      { id: "b", description: "second", done: false },
    ]};
    const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    expect(runner.state()).toBe("intake");
    await runner.intake();
    expect(runner.state()).toBe("plan");
    await runner.branch();
    expect(runner.state()).toBe("execute");
    await runner.markStepDone("a");
    await runner.markStepDone("b");
    await runner.verifyPassed();
    expect(runner.state()).toBe("summarize");
    await runner.summarize("smoke complete");
    await runner.transition("done");
    expect(runner.state()).toBe("done");
    const events = await log.read(taskId);
    expect(events.length).toBeGreaterThan(0);
  });

  it("rejects illegal transitions", async () => {
    const checkpoint = new CheckpointStore(dir);
    const memory = new SessionMemory(dir);
    const log = new SessionLog(dir);
    const worktree = new WorktreeStore(dir);
    const taskId = checkpoint.newTaskId();
    const plan: Plan = { taskId, title: "x", steps: [] };
    const runner = new TaskRunner(taskId, plan, { checkpoint, memory, log, worktree });
    await expect(runner.transition("done")).rejects.toThrow(/Illegal/);
  });
});
