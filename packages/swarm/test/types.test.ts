import { describe, it, expect } from "vitest";
import { swarmId, SWARM_ROLES, SWARM_PHASE_ORDER } from "../src/types.js";

describe("swarmId", () => {
  it("accepts a valid id", () => {
    const id = swarmId("swarm_abc123");
    expect(id).toBe("swarm_abc123");
  });

  it("accepts ids with underscores", () => {
    const id = swarmId("swarm_build_login_form_2026_06_11");
    expect(id).toBe("swarm_build_login_form_2026_06_11");
  });

  it("rejects empty string", () => {
    expect(() => swarmId("")).toThrow(/Invalid swarm id/);
  });

  it("rejects id without swarm_ prefix", () => {
    expect(() => swarmId("abc123")).toThrow(/Invalid swarm id/);
  });

  it("rejects id with uppercase", () => {
    expect(() => swarmId("swarm_ABC")).toThrow(/Invalid swarm id/);
  });

  it("rejects id with special chars", () => {
    expect(() => swarmId("swarm_abc!")).toThrow(/Invalid swarm id/);
  });
});

describe("SWARM_ROLES", () => {
  it("contains the 5 expected roles", () => {
    expect(SWARM_ROLES).toHaveLength(5);
    expect(SWARM_ROLES).toContain("planner");
    expect(SWARM_ROLES).toContain("researcher");
    expect(SWARM_ROLES).toContain("builder");
    expect(SWARM_ROLES).toContain("critic");
    expect(SWARM_ROLES).toContain("test-runner");
  });
});

describe("SWARM_PHASE_ORDER", () => {
  it("contains the 10 expected phases in order", () => {
    expect(SWARM_PHASE_ORDER).toHaveLength(10);
    expect(SWARM_PHASE_ORDER[0]).toBe("idle");
    expect(SWARM_PHASE_ORDER[SWARM_PHASE_ORDER.length - 1]).toBe("done");
  });
});
