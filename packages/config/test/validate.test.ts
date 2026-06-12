import { describe, it, expect } from "vitest";
import { validateConfig, DEFAULT_CONFIG } from "../src/index.js";

describe("validateConfig", () => {
  it("accepts DEFAULT_CONFIG", () => {
    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown version", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, version: 99 as never });
    expect(result.ok).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = validateConfig({ version: 1 } as never);
    expect(result.ok).toBe(false);
  });

  it("accepts custom modes", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      modes: [
        { name: "review", label: "REVIEW", color: "warning", activeTools: ["read"], readOnly: true },
      ],
    };
    const result = validateConfig(cfg);
    expect(result.ok).toBe(true);
  });
});
