import { CheckpointStore } from "@pi/checkpoint";
import { SessionMemory } from "@pi/memory";
import { StateMachine, canTransition } from "./state-machine.js";
import { SessionLog } from "./session-log.js";
import { WorktreeStore } from "./worktree-store.js";
import { Plan, State } from "./types.js";

export interface TaskRunnerDeps {
  checkpoint: CheckpointStore;
  memory: SessionMemory;
  log: SessionLog;
  worktree: WorktreeStore;
}

export interface TaskRunnerOpts {
  checkpointRetries?: number;
}

const DEFAULT_CHECKPOINT_RETRIES = 3;

export class TaskRunner {
  private sm: StateMachine;
  private seq = 0;
  private currentPlan: Plan;
  private checkpointRetries: number;

  constructor(
    private readonly taskId: string,
    initialPlan: Plan,
    private readonly deps: TaskRunnerDeps,
    opts: TaskRunnerOpts = {},
    initial: State = "intake",
  ) {
    this.sm = new StateMachine(initial);
    this.currentPlan = initialPlan;
    this.checkpointRetries = opts.checkpointRetries ?? DEFAULT_CHECKPOINT_RETRIES;
  }

  state(): State { return this.sm.state(); }
  getTaskId(): string { return this.taskId; }
  getPlan(): Plan { return this.currentPlan; }

  async transition(to: State, data: Record<string, unknown> = {}): Promise<void> {
    if (!canTransition(this.sm.state(), to)) {
      throw new Error(`Illegal transition: ${this.sm.state()} -> ${to}`);
    }
    this.seq++;
    await this.deps.log.append(this.taskId, { state: this.sm.state(), event: "transition", data: { to, ...data } });
    this.sm.transition(to);
    await this.snapshotWithRetry(to, data);
  }

  private async snapshotWithRetry(to: State, data: Record<string, unknown>): Promise<void> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < this.checkpointRetries; attempt++) {
      try {
        await this.deps.checkpoint.snapshot({
          seq: this.seq,
          taskId: this.taskId,
          state: to,
          gitTreeSha: "pending",
          payload: data,
        });
        return;
      } catch (e) {
        lastErr = e;
        const delayMs = 100 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    throw new Error(`Checkpoint write failed after ${this.checkpointRetries} attempts: ${(lastErr as Error)?.message}`);
  }

  async intake(): Promise<void> {
    const context = await this.deps.memory.getContext();
    await this.deps.memory.appendContext({
      ts: new Date().toISOString(),
      source: "intake",
      body: `Triage: ${this.currentPlan.title}. Existing context entries: ${context.length}`,
    });
    await this.transition("plan");
  }

  async branch(): Promise<{ branch: string; path: string }> {
    await this.transition("branch");
    const wt = this.deps.worktree.create(this.taskId);
    await this.transition("execute", { worktree: wt.path, branch: wt.branch });
    return { branch: wt.branch, path: wt.path };
  }

  async markStepDone(stepId: string): Promise<void> {
    this.currentPlan = this.sm.markStepDone(stepId, this.currentPlan);
    await this.deps.log.append(this.taskId, { state: this.sm.state(), event: "step-done", data: { stepId } });
  }

  async verifyPassed(): Promise<void> {
    await this.transition("verify", { verify: "pass" });
    await this.transition("summarize", { verify: "pass" });
  }

  async verifyFailed(reason: string): Promise<void> {
    await this.transition("execute", { verify: "fail", reason });
  }

  async summarize(prDescription: string): Promise<void> {
    await this.deps.memory.appendLearning({
      ts: new Date().toISOString(),
      source: "summarize",
      body: `Task ${this.taskId}: ${this.currentPlan.title}\n\n${prDescription}`,
    });
  }
}
