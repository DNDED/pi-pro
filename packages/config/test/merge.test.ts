import { describe, it, expect } from "vitest";
import { mergeConfig, DEFAULT_CONFIG } from "../src/index.js";

describe("mergeConfig", () => {
  it("returns base when override is empty", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {});
    expect(merged.version).toBe(DEFAULT_CONFIG.version);
  });

  it("override replaces top-level scalar", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { version: 1 });
    expect(merged.version).toBe(1);
  });

  it("override replaces nested object deeply", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { provider: { name: "openai", model: "gpt-4o" } });
    expect(merged.provider.name).toBe("openai");
    expect(merged.provider.model).toBe("gpt-4o");
  });

  it("override can add ui section", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { ui: { ...DEFAULT_CONFIG.ui, copyFriendly: true } });
    expect(merged.ui.copyFriendly).toBe(true);
  });
});
