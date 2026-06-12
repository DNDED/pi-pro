import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BudgetTracker } from "../src/budget.js";
import { Scratchpad } from "../src/scratchpad.js";
import { swarmId, type SwarmRole } from "../src/types.js";

let root: string;
let pad: Scratchpad;
let budget: BudgetTracker;
const testId = swarmId("swarm_budget_001");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pi-pro-swarm-budget-"));
  pad = new Scratchpad({ baseDir: root, swarmId: testId });
  budget = new BudgetTracker({ pad, limitUsd: 2.0 });
  await budget.load();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("BudgetTracker — initial state", () => {
  it("starts at zero spent", () => {
    expect(budget.totalUsd()).toBe(0);
  });

  it("reports the configured limit", () => {
    expect(budget.limitUsd()).toBe(2.0);
  });

  it("default warn ratio is 0.5", () => {
    expect(budget.warnRatio()).toBe(0.5);
  });

  it("custom warn ratio", () => {
    const b = new BudgetTracker({ pad, limitUsd: 1.0, warnRatio: 0.75 });
    expect(b.warnRatio()).toBe(0.75);
  });

  it("shouldWarn is false at zero", () => {
    expect(budget.shouldWarn()).toBe(false);
  });

  it("shouldKill is false at zero", () => {
    expect(budget.shouldKill()).toBe(false);
  });
});

describe("BudgetTracker — recordSubagentCost", () => {
  it("accumulates cost", () => {
    budget.recordSubagentCost("planner", 0.05);
    expect(budget.totalUsd()).toBeCloseTo(0.05, 4);
    budget.recordSubagentCost("builder", 0.20);
    expect(budget.totalUsd()).toBeCloseTo(0.25, 4);
  });

  it("tracks per-subagent breakdown", () => {
    budget.recordSubagentCost("planner", 0.05);
    budget.recordSubagentCost("builder", 0.30);
    const state = budget.getState();
    expect(state.bySubagent.planner).toBeCloseTo(0.05, 4);
    expect(state.bySubagent.builder).toBeCloseTo(0.30, 4);
  });

  it("accumulates repeated costs for the same subagent", () => {
    budget.recordSubagentCost("builder", 0.10);
    budget.recordSubagentCost("builder", 0.15);
    expect(budget.getState().bySubagent.builder).toBeCloseTo(0.25, 4);
  });
});

describe("BudgetTracker — soft warn at 50%", () => {
  it("shouldWarn true at exactly 50%", () => {
    budget.recordSubagentCost("builder", 1.0); // 50% of 2.0
    expect(budget.shouldWarn()).toBe(true);
  });

  it("shouldWarn false below 50%", () => {
    budget.recordSubagentCost("builder", 0.99);
    expect(budget.shouldWarn()).toBe(false);
  });

  it("shouldWarn true above 50%", () => {
    budget.recordSubagentCost("builder", 1.5);
    expect(budget.shouldWarn()).toBe(true);
  });
});

describe("BudgetTracker — hard kill at 100%", () => {
  it("shouldKill true at exactly limit", () => {
    budget.recordSubagentCost("builder", 2.0);
    expect(budget.shouldKill()).toBe(true);
  });

  it("shouldKill false just under limit", () => {
    budget.recordSubagentCost("builder", 1.99);
    expect(budget.shouldKill()).toBe(false);
  });

  it("shouldKill true above limit", () => {
    budget.recordSubagentCost("builder", 5.0);
    expect(budget.shouldKill()).toBe(true);
  });
});

describe("BudgetTracker — persistence", () => {
  it("persists state to scratchpad on every record", async () => {
    await budget.recordSubagentCost("planner", 0.05);
    await budget.recordSubagentCost("builder", 0.20);
    // New tracker reads from same scratchpad
    const b2 = new BudgetTracker({ pad, limitUsd: 2.0 });
    await b2.load();
    expect(b2.totalUsd()).toBeCloseTo(0.25, 4);
    expect(b2.getState().bySubagent.planner).toBeCloseTo(0.05, 4);
    expect(b2.getState().bySubagent.builder).toBeCloseTo(0.20, 4);
  });

  it("preserves state across scratchpad instances", async () => {
    await budget.recordSubagentCost("builder", 0.5);
    // Same dir, fresh Scratchpad wrapper
    const pad2 = new Scratchpad({ baseDir: root, swarmId: testId });
    const b2 = new BudgetTracker({ pad: pad2, limitUsd: 2.0 });
    await b2.load();
    expect(b2.totalUsd()).toBeCloseTo(0.5, 4);
  });
});

describe("BudgetTracker — state() shape", () => {
  it("returns full BudgetState", () => {
    budget.recordSubagentCost("planner", 0.05);
    const s = budget.getState();
    expect(s.totalUsd).toBeCloseTo(0.05, 4);
    expect(s.limitUsd).toBe(2.0);
    expect(s.warnRatio).toBe(0.5);
    expect(s.bySubagent).toBeDefined();
  });

  it("bySubagent initializes all roles to 0", () => {
    const s = budget.getState();
    const roles: SwarmRole[] = ["planner", "researcher", "builder", "critic", "test-runner"];
    for (const r of roles) {
      expect(s.bySubagent[r]).toBe(0);
    }
  });
});
