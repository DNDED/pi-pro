import { describe, it, expect } from "vitest";
import { fixtureContextFor } from "../src/fixture-context.js";

describe("bootstrap invariant: all fixtures have contexts", () => {
  it("fixture context module exports without error", () => {
    expect(fixtureContextFor).toBeDefined();
    expect(typeof fixtureContextFor).toBe("function");
  });

  it("returns non-empty strings for all known fixtures", () => {
    const fixtures = ["tiny-express", "tiny-cli", "tiny-go-svc"];
    for (const name of fixtures) {
      const ctx = fixtureContextFor(name);
      expect(typeof ctx).toBe("string");
      expect(ctx.length).toBeGreaterThan(0);
    }
  });

  it("returns empty string for unknown fixture", () => {
    expect(fixtureContextFor("unknown")).toBe("");
    expect(fixtureContextFor("")).toBe("");
  });

  it("each fixture context mentions its own name", () => {
    const fixtures = ["tiny-express", "tiny-cli", "tiny-go-svc"];
    for (const name of fixtures) {
      const ctx = fixtureContextFor(name);
      expect(ctx).toContain(name);
    }
  });

  it("each fixture context includes a test command hint", () => {
    const fixtures = ["tiny-express", "tiny-cli", "tiny-go-svc"];
    for (const name of fixtures) {
      const ctx = fixtureContextFor(name);
      expect(ctx).toMatch(/test/i);
    }
  });

  it("idempotent: returns the same value on repeated calls", () => {
    expect(fixtureContextFor("tiny-express")).toBe(fixtureContextFor("tiny-express"));
    expect(fixtureContextFor("tiny-cli")).toBe(fixtureContextFor("tiny-cli"));
    expect(fixtureContextFor("tiny-go-svc")).toBe(fixtureContextFor("tiny-go-svc"));
  });

  it("contexts do not have trailing whitespace issues", () => {
    const fixtures = ["tiny-express", "tiny-cli", "tiny-go-svc"];
    for (const name of fixtures) {
      const ctx = fixtureContextFor(name);
      expect(ctx.trim()).toBe(ctx);
    }
  });
});
