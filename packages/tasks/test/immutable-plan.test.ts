import { describe, it, expect } from "vitest";
import { StateMachine } from "../src/state-machine.js";
import { Plan } from "../src/types.js";

const plan: Plan = {
  taskId: "tsk_abc123",
  title: "test",
  steps: [
    { id: "s1", description: "first", done: false },
    { id: "s2", description: "second", done: false },
  ],
};

describe("StateMachine — immutable Plan", () => {
  it("markStepDone does not mutate the input plan", () => {
    const sm = new StateMachine();
    const before = JSON.parse(JSON.stringify(plan));
    sm.markStepDone("s1", plan);
    expect(plan).toEqual(before);
    expect(plan.steps[0].done).toBe(false);
  });

  it("markStepDone returns a new Plan with the step marked done", () => {
    const sm = new StateMachine();
    const result = sm.markStepDone("s1", plan);
    expect(result.steps[0].done).toBe(true);
    expect(result.steps[1].done).toBe(false);
    expect(result).not.toBe(plan);
    expect(result.steps).not.toBe(plan.steps);
  });

  it("calling markStepDone twice with the same id is idempotent on the original", () => {
    const sm = new StateMachine();
    const r1 = sm.markStepDone("s1", plan);
    const r2 = sm.markStepDone("s1", plan);
    expect(r1).toEqual(r2);
  });
});
