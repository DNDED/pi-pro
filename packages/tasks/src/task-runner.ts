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

  /**
   * Derive the next checkpoint seq number from disk so that two TaskRunner
   * instances on the same taskId produce non-overlapping chk_NNNNNN ids.
   */
  private async nextSeq(): Promise<number> {
    const latest = await this.deps.checkpoint.latest(this.taskId);
    if (!latest) return 1;
    const m = latest.id.match(/^chk_(\d+)$/);
    const last = m ? parseInt(m[1], 10) : 0;
    if (!Number.isFinite(last) || last < 0) return 1;
    return last + 1;
  }

  async transition(to: State, data: Record<string, unknown> = {}): Promise<void> {
    if (!canTransition(this.sm.state(), to)) {
      throw new Error(`Illegal transition: ${this.sm.state()} -> ${to}`);
    }
    await this.deps.log.append(this.taskId, { state: this.sm.state(), event: "transition", data: { to, ...data } });
    this.sm.transition(to);
    await this.snapshotWithRetry(to, data);
  }

  private async snapshotWithRetry(to: State, data: Record<string, unknown>): Promise<void> {
    const seq = await this.nextSeq();
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < this.checkpointRetries; attempt++) {
      try {
        await this.deps.checkpoint.snapshot({
          seq,
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

  /** Verify pass: transitions execute → verify → summarize. */
  async markVerifyPass(_reason?: string): Promise<void> {
    await this.transition("verify", { verify: "pass" });
    await this.transition("summarize", { verify: "pass" });
  }

  /** Verify fail: transitions execute → verify → back to execute with a reason. */
  async markVerifyFail(reason: string): Promise<void> {
    await this.transition("verify", { verify: "fail", reason });
    await this.transition("execute", { verify: "fail", reason });
  }

  // Backward-compat aliases for callers that used the old names.
  async verifyPassed(): Promise<void> { return this.markVerifyPass(); }
  async verifyFailed(reason: string): Promise<void> { return this.markVerifyFail(reason); }

  /**
   * Record the task summary in memory and transition the state to done.
   * The state should be at "summarize" when this is called (via markVerifyPass).
   */
  async summarize(prDescription: string): Promise<void> {
    await this.deps.memory.appendLearning({
      ts: new Date().toISOString(),
      source: "summarize",
      body: `Task ${this.taskId}: ${this.currentPlan.title}\n\n${prDescription}`,
    });
    if (this.sm.state() === "summarize") {
      await this.transition("done");
    }
  }
}
