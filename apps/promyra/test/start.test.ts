import { describe, it, expect } from "vitest";
import { buildPlan, formatCompletionMessage } from "../src/commands/start.js";

describe("buildPlan", () => {
  it("creates a 6-step plan when git is available", () => {
    const plan = buildPlan("tsk_abc1234567", "Add /healthz endpoint", true);
    expect(plan.steps).toHaveLength(6);
  });

  it("uses the given taskId on the plan", () => {
    const plan = buildPlan("tsk_zzz1234567", "any title", true);
    expect(plan.taskId).toBe("tsk_zzz1234567");
  });

  it("uses the description as the plan title", () => {
    const plan = buildPlan("tsk_zzz1234567", "Refactor parser", true);
    expect(plan.title).toBe("Refactor parser");
  });

  it("starts all steps as not done", () => {
    const plan = buildPlan("tsk_zzz1234567", "x", true);
    for (const step of plan.steps) {
      expect(step.done).toBe(false);
    }
  });

  it("includes the six expected step ids in order when git is available", () => {
    const plan = buildPlan("tsk_zzz1234567", "x", true);
    const ids = plan.steps.map(s => s.id);
    expect(ids).toEqual(["intake", "plan", "branch", "execute", "verify", "done"]);
  });
});

describe("formatCompletionMessage", () => {
  it("includes the taskId", () => {
    const plan = buildPlan("tsk_abcdef1234", "x", true);
    const msg = formatCompletionMessage("tsk_abcdef1234", plan, "/tmp/wt");
    expect(msg).toContain("tsk_abcdef1234");
  });

  it("instructs the user how to merge the session", () => {
    const plan = buildPlan("tsk_abcdef1234", "x", true);
    const msg = formatCompletionMessage("tsk_abcdef1234", plan, "/tmp/wt");
    expect(msg).toContain("promyra merge");
  });

  it("uses a checkmark prefix", () => {
    const plan = buildPlan("tsk_x", "x", true);
    const msg = formatCompletionMessage("tsk_x", plan, "/tmp/wt");
    expect(msg.startsWith("✓")).toBe(true);
  });

  it("matches the original CLI message byte-for-byte when worktreePath is empty", () => {
    const plan = buildPlan("tsk_x", "x");
    const msg = formatCompletionMessage("tsk_x", plan, "");
    expect(msg).toBe("✓ promyra: task tsk_x completed. Run 'promyra merge tsk_x' to inspect.");
  });
});

describe("/healthz endpoint", () => {
  it("builds a plan for the 'Add /healthz endpoint' task", () => {
    const plan = buildPlan("tsk_healthz01", "Add /healthz endpoint", true);
    expect(plan.title).toBe("Add /healthz endpoint");
    expect(plan.taskId).toBe("tsk_healthz01");
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it("includes a 'verify' step in the plan for the /healthz endpoint task", () => {
    const plan = buildPlan("tsk_healthz02", "Add /healthz endpoint", true);
    const ids = plan.steps.map(s => s.id);
    expect(ids).toContain("verify");
  });
});
