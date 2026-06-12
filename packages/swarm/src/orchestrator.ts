/**
 * v0.6.0 Orchestrator.
 *
 * Top-level state machine for a swarm. Drives the 7-phase sequence:
 *   1. PLAN       — write plan.md
 *   2. RESEARCH   — researcher reads repo, writes researcher.md
 *   3. PLAN2      — planner reads researcher, writes planner.md
 *   4. BUILD      — builder (retry on fail)
 *   5. TEST       — test-runner (verify gate)
 *   6. CRITIQUE   — critic reads builder + test results
 *   7. DECIDE     — pass → MERGE; fail → retry BUILD
 *   8. MERGE      — merge builder's worktree into main
 *
 * Phases 2+3 can run in parallel. Phases 4-6 are sequential. Recursion
 * depth = 1: subagents do not spawn subagents.
 *
 * The orchestrator takes a `SubagentDispatcher` callback that the
 * production wiring (apps/pi) plugs into `LlmWorker.run()`. Tests plug
 * in a mock dispatcher for fast, deterministic state-machine coverage.
 */

import { join } from "node:path";
import { Scratchpad } from "./scratchpad.js";
import { BudgetTracker } from "./budget.js";
import { WorktreePool } from "./worktree-pool.js";
import { VerificationGate } from "./verification-gate.js";
import { renderPlan } from "./plan-writer.js";
import { mergeWorktree } from "./merge.js";
import { resolveSubagentModel, CASCADE_BY_ROLE } from "./optimizer-integration.js";
import type {
  SwarmId, SwarmPhase, SwarmRole, SwarmPlan, SwarmState,
  SubagentResult, RosterEntry, OrchestratorResult, OrchestratorOpts,
  SwarmPauseReason, SubagentAttempt, BudgetState, TestResult,
} from "./types.js";

/**
 * Callback that the orchestrator invokes for each subagent. In
 * production this wraps `LlmWorker.run()`. In tests, it's a mock.
 */
export type SubagentDispatcher = (
  role: SwarmRole,
  goal: string,
  input: { plan: string; priorContext: string },
) => Promise<SubagentResult>;

export interface OrchestratorRunOpts extends OrchestratorOpts {
  /** The dispatcher (LlmWorker wrapper). */
  dispatcher: SubagentDispatcher;
}

const DEFAULT_TOOLS: Record<SwarmRole, string[]> = {
  "planner": ["read", "grep", "glob"],
  "researcher": ["read", "grep", "webfetch"],
  "builder": ["read", "edit", "write", "bash", "grep", "glob"],
  "critic": ["read", "grep", "glob"],
  "test-runner": ["read", "bash"],
};

const DEFAULT_MAX_RETRIES: Record<SwarmRole, number> = {
  "planner": 0, "researcher": 0, "critic": 0, "test-runner": 1, "builder": 2,
};

export class Orchestrator {
  private readonly opts: OrchestratorRunOpts;
  private readonly pad: Scratchpad;
  private readonly budget: BudgetTracker;
  private readonly pool: WorktreePool;

  constructor(opts: OrchestratorRunOpts) {
    this.opts = opts;
    this.pad = new Scratchpad({ baseDir: opts.scratchpadBase ?? join(opts.rootDir, ".promyra", "swarm"), swarmId: opts.swarmId });
    this.budget = new BudgetTracker({ pad: this.pad, limitUsd: opts.budgetUsd ?? 2.0 });
    this.pool = new WorktreePool({ rootDir: opts.rootDir, swarmId: opts.swarmId, baseDir: opts.worktreeBase });
  }

  /** Build the plan without running. */
  async plan(): Promise<SwarmPlan> {
    const roster = this.buildRoster();
    return {
      swarmId: this.opts.swarmId,
      goal: this.opts.goal,
      roster,
      topo: ["plan", "research", "plan2", "build", "test", "critique", "decide", "merge", "done"],
      parallelGroups: [["research", "plan2"]],
      budget: { limitUsd: this.opts.budgetUsd ?? 2.0, warnRatio: 0.5 },
      createdAt: Date.now(),
    };
  }

  /** Render the plan as markdown and write to plan.md. */
  async writePlan(): Promise<SwarmPlan> {
    const p = await this.plan();
    await this.pad.writeFile("plan.md", renderPlan(p));
    return p;
  }

  /** Run the full swarm. Returns the final OrchestratorResult. */
  async run(): Promise<OrchestratorResult> {
    const startedAt = Date.now();
    await this.budget.load();
    if (this.opts.dryRun) {
      await this.writePlan();
      return {
        swarmId: this.opts.swarmId,
        status: "done",
        finalResults: {},
        totalCostUsd: 0,
        totalDurationMs: 0,
        startedAt,
        endedAt: Date.now(),
      };
    }

    const plan = await this.writePlan();
    const planMarkdown = await this.pad.readFile("plan.md");
    const finalResults: Partial<Record<SwarmRole, SubagentResult>> = {};

    // Phase 1: PLAN — already written by writePlan() above
    // Phase 2+3: RESEARCH + PLAN2 in parallel
    const [researcherResult, planner2Result] = await Promise.all([
      this.runSubagent("researcher", planMarkdown, ""),
      this.runSubagent("planner", planMarkdown, "researcher already running"),
    ]);
    finalResults.researcher = researcherResult;
    finalResults.planner = planner2Result;

    if (this.shouldStop()) {
      return this.halt(finalResults, startedAt);
    }

    // Phase 4: BUILD with retry. Create the builder's worktree first.
    if (!this.opts.noWorktree) {
      try {
        this.pool.createSync("builder");
      } catch (e) {
        return this.halt(finalResults, startedAt, {
          kind: "worktree-failed",
          role: "builder",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    const buildResult = await this.runBuilderWithRetry(planMarkdown, finalResults);
    finalResults.builder = buildResult;
    if (buildResult.final.status !== "pass") {
      this.cleanupWorktree("builder");
      return this.halt(finalResults, startedAt, this.subagentFailedReason("builder", buildResult));
    }

    // Phase 5: TEST (verify gate)
    const testResult = await this.runSubagent("test-runner", planMarkdown, "builder done");
    finalResults["test-runner"] = testResult;
    if (testResult.final.status !== "pass") {
      this.cleanupWorktree("builder");
      return this.halt(finalResults, startedAt, {
        kind: "verifier-failed",
        role: "test-runner",
        failures: [testResult.final.evidence],
      });
    }

    // Phase 6: CRITIQUE
    const criticResult = await this.runSubagent("critic", planMarkdown, "tests pass");
    finalResults.critic = criticResult;

    if (this.shouldStop()) {
      this.cleanupWorktree("builder");
      return this.halt(finalResults, startedAt);
    }

    // Phase 7: DECIDE — test passed, so proceed to MERGE
    // Phase 8: MERGE
    const mergeRes = mergeWorktree({
      rootDir: this.opts.rootDir,
      swarmId: this.opts.swarmId,
      role: "builder",
    });
    this.cleanupWorktree("builder");

    if (!mergeRes.success) {
      return this.halt(finalResults, startedAt, {
        kind: "verifier-failed",
        role: "builder",
        failures: mergeRes.conflicts,
      });
    }

    return {
      swarmId: this.opts.swarmId,
      status: "done",
      finalResults,
      totalCostUsd: this.budget.totalUsd(),
      totalDurationMs: Date.now() - startedAt,
      startedAt,
      endedAt: Date.now(),
      mergedWorktree: {
        role: "builder",
        path: this.pool.pathFor("builder"),
        branch: this.pool.branchFor("builder"),
        swarmId: this.opts.swarmId,
      },
    };
  }

  private cleanupWorktree(role: SwarmRole): void {
    if (this.opts.noWorktree) return;
    try {
      this.pool.removeSync(role);
    } catch {
      // best-effort cleanup
    }
  }

  private async runSubagent(
    role: SwarmRole,
    planMarkdown: string,
    priorContext: string,
  ): Promise<SubagentResult> {
    const goal = `${role}: ${this.opts.goal}`;
    const result = await this.opts.dispatcher(role, goal, { plan: planMarkdown, priorContext });
    await this.budget.recordSubagentCost(role, result.totalCostUsd);
    // Persist the result to the scratchpad
    await this.pad.writeJSON(`${role}.result.json`, result);
    await this.pad.writeFile(`${role}.md`, this.renderResultMarkdown(role, result));
    return result;
  }

  private async runBuilderWithRetry(
    planMarkdown: string,
    prior: Partial<Record<SwarmRole, SubagentResult>>,
  ): Promise<SubagentResult> {
    const maxRetries = this.opts.maxRetries ?? DEFAULT_MAX_RETRIES.builder;
    let lastResult: SubagentResult | null = null;
    let feedback = "";
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.shouldStop()) break;
      const result = await this.runSubagent("builder", planMarkdown, this.buildBuilderFeedback(prior, lastResult, feedback));
      lastResult = result;
      if (result.final.status === "pass") return result;
      // Use the failure evidence as feedback for next attempt
      feedback = `Previous attempt failed: ${result.final.evidence}`;
    }
    return lastResult!;
  }

  private buildBuilderFeedback(
    prior: Partial<Record<SwarmRole, SubagentResult>>,
    lastResult: SubagentResult | null,
    extraFeedback: string,
  ): string {
    const lines: string[] = [];
    if (prior.planner?.final.evidence) lines.push(`Planner: ${prior.planner.final.evidence}`);
    if (prior.researcher?.final.evidence) lines.push(`Researcher: ${prior.researcher.final.evidence}`);
    if (lastResult) lines.push(`Last attempt failed: ${lastResult.final.evidence}`);
    if (extraFeedback) lines.push(extraFeedback);
    return lines.join("\n");
  }

  private shouldStop(): boolean {
    return this.budget.shouldKill();
  }

  private halt(
    finalResults: Partial<Record<SwarmRole, SubagentResult>>,
    startedAt: number,
    pauseReason?: SwarmPauseReason,
  ): OrchestratorResult {
    const reason: SwarmPauseReason | undefined = pauseReason ?? (
      this.budget.shouldKill()
        ? { kind: "budget-exceeded", totalUsd: this.budget.totalUsd(), limitUsd: this.budget.limitUsd() }
        : undefined
    );
    return {
      swarmId: this.opts.swarmId,
      status: "paused",
      finalResults,
      totalCostUsd: this.budget.totalUsd(),
      totalDurationMs: Date.now() - startedAt,
      startedAt,
      endedAt: Date.now(),
      pauseReason: reason,
    };
  }

  private subagentFailedReason(role: SwarmRole, result: SubagentResult): SwarmPauseReason {
    return {
      kind: "subagent-failed",
      role,
      attempts: result.attempts.length,
      lastError: result.final.evidence,
    };
  }

  private buildRoster(): RosterEntry[] {
    return (Object.keys(CASCADE_BY_ROLE) as SwarmRole[]).map(role => ({
      role,
      model: resolveSubagentModel(role, this.opts.provider, this.opts.mainModel),
      tools: DEFAULT_TOOLS[role],
      maxRetries: DEFAULT_MAX_RETRIES[role],
    }));
  }

  private renderResultMarkdown(role: SwarmRole, result: SubagentResult): string {
    const lines: string[] = [];
    lines.push(`# ${role}`);
    lines.push("");
    lines.push(`**Status:** ${result.final.status}`);
    lines.push(`**Attempts:** ${result.attempts.length}`);
    lines.push(`**Total cost:** $${result.totalCostUsd.toFixed(4)}`);
    lines.push(`**Total tokens:** ${result.totalTokensIn}↗/${result.totalTokensOut}↘`);
    lines.push("");
    lines.push("## Evidence");
    lines.push("");
    lines.push(result.final.evidence);
    return lines.join("\n");
  }
}
