import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { Orchestrator, type SubagentDispatcher } from "../src/orchestrator.js";
import { swarmId, type SwarmRole, type SubagentResult } from "../src/types.js";

let root: string;
const testId = swarmId("swarm_orch_001");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pi-pro-swarm-orch-"));
  execSync("git init -q -b main", { cwd: root, shell: "/bin/sh" });
  execSync("git config user.email t@local", { cwd: root, shell: "/bin/sh" });
  execSync("git config user.name t", { cwd: root, shell: "/bin/sh" });
  await writeFile(join(root, "README.md"), "# init");
  execSync('git add -A && git commit -q -m "init"', { cwd: root, shell: "/bin/sh" });
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

/** Mock dispatcher that always returns pass. */
function makePassingDispatcher(costUsd: number = 0.05): SubagentDispatcher {
  return async (role, _goal, _input) => ({
    role,
    attempts: [{
      attempt: 1,
      status: "pass",
      evidence: `${role} passed`,
      tokensIn: 100,
      tokensOut: 50,
      costUsd,
      durationMs: 10,
    }],
    final: { attempt: 1, status: "pass", evidence: `${role} passed`, tokensIn: 100, tokensOut: 50, costUsd, durationMs: 10 },
    totalCostUsd: costUsd,
    totalTokensIn: 100,
    totalTokensOut: 50,
  });
}

/** Mock dispatcher where builder fails first attempt, then passes. */
function makeFlakyBuilderDispatcher(failCount: number, passCost: number = 0.10): SubagentDispatcher {
  let attempts = 0;
  return async (role, _goal, _input) => {
    if (role === "builder") {
      attempts++;
      if (attempts <= failCount) {
        return {
          role,
          attempts: [{
            attempt: attempts, status: "fail", evidence: "build failed", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10,
          }],
          final: { attempt: attempts, status: "fail", evidence: "build failed", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10 },
          totalCostUsd: 0.05, totalTokensIn: 100, totalTokensOut: 50,
        };
      }
      return {
        role,
        attempts: [{
          attempt: attempts, status: "pass", evidence: "ok", tokensIn: 100, tokensOut: 50, costUsd: passCost, durationMs: 10,
        }],
        final: { attempt: attempts, status: "pass", evidence: "ok", tokensIn: 100, tokensOut: 50, costUsd: passCost, durationMs: 10 },
        totalCostUsd: passCost, totalTokensIn: 100, totalTokensOut: 50,
      };
    }
    return makePassingDispatcher(0.05)(role, _goal, _input);
  };
}

describe("Orchestrator — happy path", () => {
  it("runs all 5 subagents and reports done", async () => {
    const calls: SwarmRole[] = [];
    const dispatcher: SubagentDispatcher = async (role, _goal, _input) => {
      calls.push(role);
      return makePassingDispatcher(0.05)(role, _goal, _input);
    };

    const orch = new Orchestrator({
      rootDir: root,
      swarmId: testId,
      goal: "add hello world",
      provider: "anthropic",
      mainModel: "claude-sonnet-4-5",
      dispatcher,
      budgetUsd: 2.0,
    });
    const result = await orch.run();
    expect(result.status).toBe("done");
    expect(calls).toContain("planner");
    expect(calls).toContain("researcher");
    expect(calls).toContain("builder");
    expect(calls).toContain("critic");
    expect(calls).toContain("test-runner");
    // 5 roles + 1 orchestrator plan = 5+ calls (planner might be called twice in plan+plan2)
    expect(calls.length).toBeGreaterThanOrEqual(5);
  });

  it("writes plan.md to scratchpad", async () => {
    const dispatcher: SubagentDispatcher = async (role, goal, _input) => {
      if (role === "planner") {
        // First call (plan): return plan
        // Second call (plan2): return research digest
        if (goal.includes("plan")) {
          return makePassingDispatcher(0.05)(role, goal, _input);
        }
      }
      return makePassingDispatcher(0.05)(role, goal, _input);
    };

    const orch = new Orchestrator({
      rootDir: root,
      swarmId: testId,
      goal: "add hello world",
      provider: "anthropic",
      mainModel: "claude-sonnet-4-5",
      dispatcher,
    });
    await orch.run();

    const planFile = join(root, ".pi-pro", "swarm", "swarm_orch_001", "plan.md");
    const exists = (await import("node:fs")).existsSync(planFile);
    expect(exists).toBe(true);
  });
});

describe("Orchestrator — retry on builder failure", () => {
  it("retries builder up to 2 times then accepts pass", async () => {
    let builderAttempts = 0;
    const dispatcher: SubagentDispatcher = async (role, goal, input) => {
      if (role === "builder") {
        builderAttempts++;
        if (builderAttempts === 1) {
          return {
            role,
            attempts: [{ attempt: 1, status: "fail", evidence: "compilation error", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10 }],
            final: { attempt: 1, status: "fail", evidence: "compilation error", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10 },
            totalCostUsd: 0.05, totalTokensIn: 100, totalTokensOut: 50,
          };
        }
        return {
          role,
          attempts: [{ attempt: 2, status: "pass", evidence: "fixed", tokensIn: 100, tokensOut: 50, costUsd: 0.10, durationMs: 10 }],
          final: { attempt: 2, status: "pass", evidence: "fixed", tokensIn: 100, tokensOut: 50, costUsd: 0.10, durationMs: 10 },
          totalCostUsd: 0.10, totalTokensIn: 100, totalTokensOut: 50,
        };
      }
      return makePassingDispatcher(0.05)(role, goal, input);
    };

    const orch = new Orchestrator({
      rootDir: root,
      swarmId: testId,
      goal: "fix bug",
      provider: "anthropic",
      mainModel: "claude-sonnet-4-5",
      dispatcher,
    });
    const result = await orch.run();
    expect(result.status).toBe("done");
    expect(builderAttempts).toBe(2);
  });

  it("halts with paused: subagent-failed after max retries", async () => {
    const dispatcher: SubagentDispatcher = async (role, goal, input) => {
      if (role === "builder") {
        return {
          role,
          attempts: [
            { attempt: 1, status: "fail", evidence: "e1", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10 },
            { attempt: 2, status: "fail", evidence: "e2", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10 },
            { attempt: 3, status: "fail", evidence: "e3", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10 },
          ],
          final: { attempt: 3, status: "fail", evidence: "e3", tokensIn: 100, tokensOut: 50, costUsd: 0.05, durationMs: 10 },
          totalCostUsd: 0.15, totalTokensIn: 300, totalTokensOut: 150,
        };
      }
      return makePassingDispatcher(0.05)(role, goal, input);
    };

    const orch = new Orchestrator({
      rootDir: root,
      swarmId: testId,
      goal: "fix bug",
      provider: "anthropic",
      mainModel: "claude-sonnet-4-5",
      dispatcher,
    });
    const result = await orch.run();
    expect(result.status).toBe("paused");
    expect(result.pauseReason?.kind).toBe("subagent-failed");
  });
});

describe("Orchestrator — budget kill", () => {
  it("halts when budget is exceeded", async () => {
    // Make every subagent cost $0.20. After 10 subagents, budget is exhausted.
    const expensiveDispatcher: SubagentDispatcher = async (role, goal, input) => {
      return makePassingDispatcher(0.20)(role, goal, input);
    };

    const orch = new Orchestrator({
      rootDir: root,
      swarmId: testId,
      goal: "expensive goal",
      provider: "anthropic",
      mainModel: "claude-sonnet-4-5",
      dispatcher: expensiveDispatcher,
      budgetUsd: 0.50, // tight budget
    });
    const result = await orch.run();
    // Budget $0.50 / $0.20 per subagent = 2-3 subagents before kill
    expect(result.status).toBe("paused");
    expect(result.pauseReason?.kind).toBe("budget-exceeded");
  });
});

describe("Orchestrator — plan-only mode", () => {
  it("dryRun returns plan without dispatching", async () => {
    let dispatched = false;
    const dispatcher: SubagentDispatcher = async (role, _goal, _input) => {
      dispatched = true;
      return makePassingDispatcher(0.05)(role, _goal, _input);
    };

    const orch = new Orchestrator({
      rootDir: root,
      swarmId: testId,
      goal: "plan only",
      provider: "anthropic",
      mainModel: "claude-sonnet-4-5",
      dispatcher,
      dryRun: true,
    });
    const result = await orch.run();
    expect(result.status).toBe("done"); // dry-run completes immediately
    expect(dispatched).toBe(false);
    expect(result.totalCostUsd).toBe(0);
  });
});
