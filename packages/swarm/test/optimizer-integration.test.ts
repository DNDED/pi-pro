import { describe, it, expect } from "vitest";
import { resolveSubagentModel, CASCADE_BY_ROLE } from "../src/optimizer-integration.js";

describe("resolveSubagentModel", () => {
  it("planner → cheap (Haiku-class)", () => {
    expect(resolveSubagentModel("planner", "anthropic", "claude-sonnet-4-5")).toBe("claude-haiku-4-5");
  });

  it("researcher → cheap (Haiku-class)", () => {
    expect(resolveSubagentModel("researcher", "anthropic", "claude-sonnet-4-5")).toBe("claude-haiku-4-5");
  });

  it("critic → cheap (Haiku-class)", () => {
    expect(resolveSubagentModel("critic", "anthropic", "claude-sonnet-4-5")).toBe("claude-haiku-4-5");
  });

  it("test-runner → cheap (Haiku-class)", () => {
    expect(resolveSubagentModel("test-runner", "anthropic", "claude-sonnet-4-5")).toBe("claude-haiku-4-5");
  });

  it("builder → main (Sonnet-class)", () => {
    expect(resolveSubagentModel("builder", "anthropic", "claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
  });

  it("opencode-go + deepseek-v4-pro → builder uses deepseek-v4-pro, others use deepseek-v4-flash", () => {
    expect(resolveSubagentModel("builder", "opencode-go", "deepseek-v4-pro")).toBe("deepseek-v4-pro");
    expect(resolveSubagentModel("planner", "opencode-go", "deepseek-v4-pro")).toBe("deepseek-v4-flash");
  });

  it("override: forceModel beats cascade", () => {
    expect(resolveSubagentModel("builder", "anthropic", "claude-sonnet-4-5", "claude-opus-4-7")).toBe("claude-opus-4-7");
  });

  it("unknown role → main (safe default)", () => {
    expect(resolveSubagentModel("garbage" as never, "anthropic", "claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
  });
});

describe("CASCADE_BY_ROLE", () => {
  it("has 5 entries", () => {
    expect(Object.keys(CASCADE_BY_ROLE)).toHaveLength(5);
  });

  it("only builder is 'main'", () => {
    const mainRoles = Object.entries(CASCADE_BY_ROLE).filter(([_, v]) => v === "main");
    expect(mainRoles.map(([r]) => r)).toEqual(["builder"]);
  });

  it("planner/researcher/critic/test-runner are all 'cheap'", () => {
    const cheapRoles = Object.entries(CASCADE_BY_ROLE).filter(([_, v]) => v === "cheap").map(([r]) => r).sort();
    expect(cheapRoles).toEqual(["critic", "planner", "researcher", "test-runner"]);
  });
});
