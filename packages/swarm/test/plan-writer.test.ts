import { describe, it, expect } from "vitest";
import { renderPlan, parsePlan } from "../src/plan-writer.js";
import { swarmId, type SwarmPlan } from "../src/types.js";

const plan: SwarmPlan = {
  swarmId: swarmId("swarm_test_plan"),
  goal: "Add a /healthz endpoint to the Express app",
  roster: [
    { role: "planner", model: "claude-haiku-4-5", tools: ["read", "grep", "glob"], maxRetries: 0 },
    { role: "researcher", model: "claude-haiku-4-5", tools: ["read", "webfetch"], maxRetries: 0 },
    { role: "builder", model: "claude-sonnet-4-5", tools: ["read", "edit", "write", "bash"], maxRetries: 2 },
    { role: "critic", model: "claude-haiku-4-5", tools: ["read"], maxRetries: 0 },
    { role: "test-runner", model: "claude-haiku-4-5", tools: ["bash", "read"], maxRetries: 1 },
  ],
  topo: ["plan", "research", "plan2", "build", "test", "critique", "decide", "merge", "done"],
  parallelGroups: [["research", "plan2"]],
  budget: { limitUsd: 2.0, warnRatio: 0.5 },
  createdAt: 1700000000000,
};

describe("renderPlan", () => {
  it("includes the goal in the title", () => {
    const md = renderPlan(plan);
    expect(md).toContain("Add a /healthz endpoint to the Express app");
  });

  it("includes a roster table", () => {
    const md = renderPlan(plan);
    expect(md).toContain("| Role |");
    expect(md).toContain("builder");
    expect(md).toContain("claude-sonnet-4-5");
  });

  it("includes the topo order", () => {
    const md = renderPlan(plan);
    expect(md).toContain("plan → research");
    expect(md).toContain("→ merge");
  });

  it("highlights parallel groups", () => {
    const md = renderPlan(plan);
    expect(md).toContain("parallel");
  });

  it("shows the budget", () => {
    const md = renderPlan(plan);
    expect(md).toContain("$2.00");
    expect(md).toContain("50%"); // warn ratio
  });

  it("shows per-role max retries", () => {
    const md = renderPlan(plan);
    expect(md).toContain("builder");
    expect(md).toContain("2 retries"); // builder maxRetries: 2
  });

  it("is plain markdown (no JSON blobs)", () => {
    const md = renderPlan(plan);
    expect(md).not.toContain('"role":');
    expect(md).not.toContain('"swarmId":');
  });
});

describe("parsePlan", () => {
  it("round-trips a plan through markdown (lossy but readable)", () => {
    const md = renderPlan(plan);
    // parsePlan is for extracting the goal from a plan.md; not full fidelity
    const recovered = parsePlan(md);
    expect(recovered.goal).toContain("/healthz");
  });

  it("returns a goal even on garbage input", () => {
    const recovered = parsePlan("random text without structure");
    expect(recovered.goal).toBeTruthy();
  });
});
