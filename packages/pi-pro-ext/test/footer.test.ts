import { describe, it, expect } from "vitest";
import { buildStarshipFooter } from "../src/footer.js";

describe("buildStarshipFooter", () => {
  it("renders cwd + mode + version", () => {
    const out = buildStarshipFooter({
      cwd: "/home/user/proj",
      branch: null,
      gitIcons: "",
      runtime: null,
      mode: "build",
      modeReadOnly: false,
      nerdFonts: false,
    });
    expect(out).toContain("proj");
    expect(out).toContain("BUILD");
    expect(out).toContain("v0.2.0");
  });

  it("adds branch when provided", () => {
    const out = buildStarshipFooter({
      cwd: "/x", branch: "main", gitIcons: "", runtime: null, mode: "build", modeReadOnly: false, nerdFonts: false,
    });
    expect(out).toContain("on main");
  });

  it("adds git icons when provided", () => {
    const out = buildStarshipFooter({
      cwd: "/x", branch: "main", gitIcons: "!2?1", runtime: null, mode: "build", modeReadOnly: false, nerdFonts: false,
    });
    expect(out).toContain("!2?1");
  });

  it("adds runtime when provided", () => {
    const out = buildStarshipFooter({
      cwd: "/x", branch: null, gitIcons: "", runtime: "node 20.0.0", mode: "build", modeReadOnly: false, nerdFonts: false,
    });
    expect(out).toContain("via node 20.0.0");
  });

  it("shows RO suffix in plan mode", () => {
    const out = buildStarshipFooter({
      cwd: "/x", branch: null, gitIcons: "", runtime: null, mode: "plan", modeReadOnly: true, nerdFonts: false,
    });
    expect(out).toContain("PLAN RO");
  });

  it("uses ASCII cwd icon when nerdFonts=false", () => {
    const out = buildStarshipFooter({
      cwd: "/x", branch: null, gitIcons: "", runtime: null, mode: "build", modeReadOnly: false, nerdFonts: false,
    });
    expect(out).not.toContain("󰝰");
  });
});
