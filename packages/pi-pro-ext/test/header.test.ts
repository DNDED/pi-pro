import { describe, it, expect } from "vitest";
import { buildHeaderLines } from "../src/header.js";

describe("buildHeaderLines", () => {
  it("includes title, version, mode badge, tokens", () => {
    const out = buildHeaderLines({
      mode: "build",
      tokens: 5000,
      contextWindow: 200000,
      percent: 0.025,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toContain("PI pro");
    expect(out[0]).toContain("v0.2.5");
    expect(out[0]).toContain("BUILD");
    expect(out[0]).toContain("5.0K/200.0K");
    expect(out[0]).toContain("3%");
  });

  it("shows PLAN RO when in plan mode", () => {
    const out = buildHeaderLines({ mode: "plan", tokens: null, contextWindow: null, percent: null });
    expect(out[0]).toContain("PLAN RO");
  });

  it("shows 'tokens: n/a' when token info missing", () => {
    const out = buildHeaderLines({ mode: "build", tokens: null, contextWindow: null, percent: null });
    expect(out[0]).toContain("tokens: n/a");
  });

  it("includes 3 OSC 8 links (github, docs, help)", () => {
    const out = buildHeaderLines({ mode: "build", tokens: 0, contextWindow: 200000, percent: 0 });
    const line = out[0]!;
    expect(line).toMatch(/github\.com\/DNDED\/pi-pro/);
    expect(line).toMatch(/pi\.dev/);
  });
});
