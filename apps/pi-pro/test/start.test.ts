import { describe, it, expect } from "vitest";
import { buildPlan, formatCompletionMessage } from "../src/commands/start.js";

describe("buildPlan", () => {
  it("creates a 6-step plan", () => {
    const plan = buildPlan("tsk_abc1234567", "Add /healthz endpoint");
    expect(plan.steps).toHaveLength(6);
  });

  it("uses the given taskId on the plan", () => {
    const plan = buildPlan("tsk_zzz1234567", "any title");
    expect(plan.taskId).toBe("tsk_zzz1234567");
  });

  it("uses the description as the plan title", () => {
    const plan = buildPlan("tsk_zzz1234567", "Refactor parser");
    expect(plan.title).toBe("Refactor parser");
  });

  it("starts all steps as not done", () => {
    const plan = buildPlan("tsk_zzz1234567", "x");
    for (const step of plan.steps) {
      expect(step.done).toBe(false);
    }
  });

  it("includes the six expected step ids in order", () => {
    const plan = buildPlan("tsk_zzz1234567", "x");
    const ids = plan.steps.map(s => s.id);
    expect(ids).toEqual(["intake", "plan", "branch", "execute", "verify", "summarize"]);
  });
});

describe("formatCompletionMessage", () => {
  it("includes the taskId", () => {
    const plan = buildPlan("tsk_abcdef1234", "x");
    const msg = formatCompletionMessage("tsk_abcdef1234", plan, "/tmp/wt");
    expect(msg).toContain("tsk_abcdef1234");
  });

  it("instructs the user how to replay the session", () => {
    const plan = buildPlan("tsk_abcdef1234", "x");
    const msg = formatCompletionMessage("tsk_abcdef1234", plan, "/tmp/wt");
    expect(msg).toContain("pi-pro replay");
  });

  it("uses a checkmark prefix", () => {
    const plan = buildPlan("tsk_x", "x");
    const msg = formatCompletionMessage("tsk_x", plan, "/tmp/wt");
    expect(msg.startsWith("✓")).toBe(true);
  });

  it("matches the original CLI message byte-for-byte when worktreePath is empty", () => {
    const plan = buildPlan("tsk_x", "x");
    const msg = formatCompletionMessage("tsk_x", plan, "");
    expect(msg).toBe("✓ pi-pro: task tsk_x completed. Run 'pi-pro replay tsk_x' to inspect.");
  });
});
