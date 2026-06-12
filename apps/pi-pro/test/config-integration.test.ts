import { describe, it, expect } from "vitest";
import { getConfigPath, loadConfig, saveConfig, applyEnvOverrides, mergeConfig, getDefaultModes, validateConfig } from "@pi/config";

describe("@pi/config integration (smoke)", () => {
  it("getConfigPath returns a .pi/pi.json path", () => {
    const p = getConfigPath();
    expect(p.endsWith(".pi/pi.json")).toBe(true);
  });

  it("loadConfig returns defaults when file missing", () => {
    const cfg = loadConfig("/nonexistent/pi.json");
    expect(cfg.version).toBe(1);
  });

  it("getDefaultModes returns build + plan", () => {
    const modes = getDefaultModes();
    expect(modes.find((m) => m.name === "build")).toBeDefined();
    expect(modes.find((m) => m.name === "plan")).toBeDefined();
  });

  it("applyEnvOverrides respects PI_MODEL", () => {
    const cfg = applyEnvOverrides(loadConfig("/nonexistent.json"), { PI_MODEL: "gpt-4o" });
    expect(cfg.provider.model).toBe("gpt-4o");
  });

  it("mergeConfig merges deep objects", () => {
    const merged = mergeConfig(loadConfig("/nonexistent.json"), { agent: { name: "plan", maxIterations: 5, toolBudget: 2 } });
    expect(merged.agent.name).toBe("plan");
  });

  it("validateConfig round-trips", () => {
    const cfg = loadConfig("/nonexistent.json");
    const result = validateConfig(cfg);
    expect(result.ok).toBe(true);
  });

  it("saveConfig + loadConfig round-trips a custom value", () => {
    const tmp = "/tmp/pi-pro-test-config.json";
    const cfg = loadConfig("/nonexistent.json");
    saveConfig({ ...cfg, provider: { ...cfg.provider, model: "test-model" } }, tmp);
    const loaded = loadConfig(tmp);
    expect(loaded.provider.model).toBe("test-model");
  });
});
