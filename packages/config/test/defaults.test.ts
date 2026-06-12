import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, getDefaultModes } from "../src/index.js";

describe("DEFAULT_CONFIG", () => {
  it("has version 1", () => {
    expect(DEFAULT_CONFIG.version).toBe(1);
  });

  it("has provider with name and model", () => {
    expect(DEFAULT_CONFIG.provider.name).toBeDefined();
    expect(DEFAULT_CONFIG.provider.model).toBeDefined();
  });

  it("has agent with name, maxIterations, toolBudget", () => {
    expect(DEFAULT_CONFIG.agent.name).toBeDefined();
    expect(DEFAULT_CONFIG.agent.maxIterations).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.agent.toolBudget).toBeGreaterThan(0);
  });
});

describe("getDefaultModes", () => {
  it("returns build and plan", () => {
    const modes = getDefaultModes();
    expect(modes.find((m) => m.name === "build")).toBeDefined();
    expect(modes.find((m) => m.name === "plan")).toBeDefined();
  });

  it("build mode has all tools", () => {
    const modes = getDefaultModes();
    const build = modes.find((m) => m.name === "build")!;
    expect(build.activeTools.length).toBeGreaterThan(3);
    expect(build.readOnly).toBe(false);
  });

  it("plan mode is read-only with limited tools", () => {
    const modes = getDefaultModes();
    const plan = modes.find((m) => m.name === "plan")!;
    expect(plan.readOnly).toBe(true);
    expect(plan.activeTools).toContain("read");
    expect(plan.activeTools).not.toContain("write");
    expect(plan.activeTools).not.toContain("edit");
  });
});
