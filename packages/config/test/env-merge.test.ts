import { describe, it, expect } from "vitest";
import { applyEnvOverrides, DEFAULT_CONFIG } from "../src/index.js";

describe("applyEnvOverrides", () => {
  it("returns base when no env vars set", () => {
    const result = applyEnvOverrides(DEFAULT_CONFIG, {});
    expect(result.version).toBe(DEFAULT_CONFIG.version);
  });

  it("overrides model from env", () => {
    const result = applyEnvOverrides(DEFAULT_CONFIG, { PI_MODEL: "gpt-4o" });
    expect(result.provider.model).toBe("gpt-4o");
  });

  it("overrides agent name from env", () => {
    const result = applyEnvOverrides(DEFAULT_CONFIG, { PI_AGENT: "plan" });
    expect(result.agent.name).toBe("plan");
  });
});
