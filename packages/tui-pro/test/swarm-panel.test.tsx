import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { SwarmPanel, formatSwarmStateLine, colorForRole, colorForStatus, colorForBudget } from "../src/components/SwarmPanel.js";
import type { SwarmState, SwarmRole, SwarmPauseReason, TestResult } from "@promyra/swarm";

function mkState(over: Partial<SwarmState> = {}): SwarmState {
  return {
    swarmId: "swarm_test_001" as never,
    goal: "add a hello world endpoint",
    status: "running",
    currentPhase: "build",
    results: {
      planner: { role: "planner", attempts: [{ attempt: 1, status: "pass", evidence: "ok", tokensIn: 0, tokensOut: 0, costUsd: 0.05, durationMs: 0 }], final: { attempt: 1, status: "pass", evidence: "ok", tokensIn: 0, tokensOut: 0, costUsd: 0.05, durationMs: 0 }, totalCostUsd: 0.05, totalTokensIn: 0, totalTokensOut: 0 },
      builder: { role: "builder", attempts: [{ attempt: 1, status: "pass", evidence: "done", tokensIn: 0, tokensOut: 0, costUsd: 0.30, durationMs: 0 }], final: { attempt: 1, status: "pass", evidence: "done", tokensIn: 0, tokensOut: 0, costUsd: 0.30, durationMs: 0 }, totalCostUsd: 0.30, totalTokensIn: 0, totalTokensOut: 0 },
    } as never,
    budget: {
      totalUsd: 0.35,
      bySubagent: { planner: 0.05, researcher: 0, builder: 0.30, critic: 0, "test-runner": 0 } as never,
      limitUsd: 2.0,
      warnRatio: 0.5,
    },
    startedAt: Date.now() - 45_000,
    updatedAt: Date.now(),
    ...over,
  };
}

describe("SwarmPanel — basic rendering", () => {
  it("renders the goal in the header", () => {
    const { lastFrame } = render(<SwarmPanel state={mkState()} />);
    expect(lastFrame()).toContain("add a hello world endpoint");
  });

  it("renders the current phase", () => {
    const { lastFrame } = render(<SwarmPanel state={mkState({ currentPhase: "test" })} />);
    expect(lastFrame()).toContain("test");
  });

  it("shows 'no active swarm' when state is null", () => {
    const { lastFrame } = render(<SwarmPanel state={null} />);
    expect(lastFrame()).toContain("no active swarm");
  });
});

describe("SwarmPanel — subagent rows", () => {
  it("shows each subagent with state and cost", () => {
    const { lastFrame } = render(<SwarmPanel state={mkState()} />);
    const out = lastFrame();
    expect(out).toContain("planner");
    expect(out).toContain("builder");
    expect(out).toContain("$0.0500"); // planner
    expect(out).toContain("$0.3000"); // builder
  });

  it("shows pending agents as '...' with zero cost", () => {
    const { lastFrame } = render(<SwarmPanel state={mkState({ results: {} })} />);
    const out = lastFrame();
    expect(out).toContain("planner");
    expect(out).toContain("..."); // pending
  });
});

describe("SwarmPanel — budget states", () => {
  it("green color when under warn ratio", () => {
    expect(colorForBudget(0.4, 2.0, 0.5)).toBe("green");
  });

  it("yellow color when at/over warn ratio, under limit", () => {
    expect(colorForBudget(1.0, 2.0, 0.5)).toBe("yellow");
  });

  it("red color when at/over limit", () => {
    expect(colorForBudget(2.0, 2.0, 0.5)).toBe("red");
    expect(colorForBudget(2.5, 2.0, 0.5)).toBe("red");
  });
});

describe("SwarmPanel — pause reason", () => {
  it("shows 'budget exceeded' when budget pause reason", () => {
    const reason: SwarmPauseReason = { kind: "budget-exceeded", totalUsd: 2.5, limitUsd: 2.0 };
    const { lastFrame } = render(<SwarmPanel state={mkState({ status: "paused", pauseReason: reason })} />);
    expect(lastFrame()).toMatch(/budget.*exceeded/i);
  });

  it("shows 'subagent failed' when subagent pause reason", () => {
    const reason: SwarmPauseReason = { kind: "subagent-failed", role: "builder", attempts: 3, lastError: "compilation error" };
    const { lastFrame } = render(<SwarmPanel state={mkState({ status: "paused", pauseReason: reason })} />);
    expect(lastFrame()).toMatch(/builder.*failed/i);
  });
});

describe("colorForRole", () => {
  it("returns distinct colors for each role", () => {
    const roles: SwarmRole[] = ["planner", "researcher", "builder", "critic", "test-runner"];
    const colors = new Set(roles.map(r => colorForRole(r)));
    expect(colors.size).toBe(5);
  });
});

describe("colorForStatus", () => {
  it("green for pass", () => expect(colorForStatus("pass")).toBe("green"));
  it("red for fail", () => expect(colorForStatus("fail")).toBe("red"));
  it("red for blocked", () => expect(colorForStatus("blocked")).toBe("red"));
  it("gray for running", () => expect(colorForStatus("running")).toBe("gray"));
  it("gray for pending", () => expect(colorForStatus("pending")).toBe("gray"));
});

describe("formatSwarmStateLine", () => {
  it("formats a summary line for the footer", () => {
    const line = formatSwarmStateLine(mkState());
    expect(line).toContain("planner+builder");
    expect(line).toContain("$0.35");
    expect(line).toContain("$2.00");
  });
});
