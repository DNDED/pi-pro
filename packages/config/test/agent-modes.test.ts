import { describe, it, expect } from "vitest";
import { cycleMode, getMode, listModes, getNextMode } from "../src/index.js";
import { getDefaultModes } from "../src/index.js";

describe("agent modes — cycle", () => {
  it("cycles build → plan", () => {
    const next = cycleMode("build", getDefaultModes());
    expect(next).toBe("plan");
  });

  it("cycles plan → build (wraps)", () => {
    const next = cycleMode("plan", getDefaultModes());
    expect(next).toBe("build");
  });

  it("returns first mode for unknown input", () => {
    const next = cycleMode("review", getDefaultModes());
    expect(next).toBe("build");
  });
});

describe("agent modes — lookup", () => {
  it("getMode returns mode by name", () => {
    const m = getMode("build", getDefaultModes());
    expect(m?.name).toBe("build");
    expect(m?.readOnly).toBe(false);
  });

  it("getMode returns undefined for unknown", () => {
    const m = getMode("nonexistent", getDefaultModes());
    expect(m).toBeUndefined();
  });

  it("listModes returns all modes", () => {
    const modes = listModes(getDefaultModes());
    expect(modes.length).toBe(2);
  });

  it("getNextMode cycles current mode", () => {
    const next = getNextMode("build", getDefaultModes());
    expect(next.name).toBe("plan");
  });
});
