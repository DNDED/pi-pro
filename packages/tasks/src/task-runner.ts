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

export class TaskRunner {
  private sm: StateMachine;
  private seq = 0;

  constructor(
    private readonly taskId: string,
    private readonly plan: Plan,
    private readonly deps: TaskRunnerDeps,
    initial: State = "intake",
  ) {
    this.sm = new StateMachine(initial);
  }

  state(): State { return this.sm.state(); }
  getTaskId(): string { return this.taskId; }
  getPlan(): Plan { return this.plan; }

  async transition(to: State, data: Record<string, unknown> = {}): Promise<void> {
    if (!canTransition(this.sm.state(), to)) {
      throw new Error(`Illegal transition: ${this.sm.state()} -> ${to}`);
    }
    this.seq++;
    await this.deps.log.append(this.taskId, { state: this.sm.state(), event: "transition", data: { to, ...data } });
    this.sm.transition(to);
    await this.deps.checkpoint.snapshot({
      seq: this.seq,
      taskId: this.taskId,
      state: to,
      gitTreeSha: "pending",
      payload: data,
    });
  }

  async intake(): Promise<void> {
    const context = await this.deps.memory.getContext();
    await this.deps.memory.appendContext({
      ts: new Date().toISOString(),
      source: "intake",
      body: `Triage: ${this.plan.title}. Existing context entries: ${context.length}`,
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
    this.sm.markStepDone(stepId, this.plan);
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
      body: `Task ${this.taskId}: ${this.plan.title}\n\n${prDescription}`,
    });
  }
}
