import { describe, it, expect } from "vitest";
import { buildStarshipFooter, buildColoredFooter, type FooterOpts } from "../src/footer.js";

const baseOpts: FooterOpts = {
  cwd: "/home/trader/Developer/pi-pro",
  branch: "master",
  gitIcons: " ",
  runtime: "node 20",
  mode: "build",
  modeReadOnly: false,
  nerdFonts: false,
  version: "0.2.1",
};

describe("buildStarshipFooter", () => {
  it("includes version, mode, cwd, branch, runtime", () => {
    const out = buildStarshipFooter(baseOpts);
    expect(out).toContain("pi-pro v0.2.1");
    expect(out).toContain("BUILD");
    expect(out).toContain("pi-pro");
    expect(out).toContain("master");
    expect(out).toContain("node 20");
  });

  it("marks RO mode", () => {
    const out = buildStarshipFooter({ ...baseOpts, mode: "plan", modeReadOnly: true });
    expect(out).toContain("PLAN RO");
  });

  it("omits branch when null", () => {
    const out = buildStarshipFooter({ ...baseOpts, branch: null });
    expect(out).not.toContain(" on ");
  });

  it("omits runtime when null", () => {
    const out = buildStarshipFooter({ ...baseOpts, runtime: null });
    expect(out).not.toContain(" via ");
  });

  it("includes nerd-font cwd icon when enabled", () => {
    const out = buildStarshipFooter({ ...baseOpts, nerdFonts: true });
    expect(out).toMatch(/^[^\s]+\s/);
  });

  it("includes git icons when present", () => {
    const out = buildStarshipFooter({ ...baseOpts, gitIcons: "M " });
    expect(out).toContain("M ");
  });
});

describe("buildColoredFooter", () => {
  it("returns segments for all parts", () => {
    const segs = buildColoredFooter({ ...baseOpts, gitState: "modified" });
    const text = segs.map((s) => s.text).join("");
    expect(text).toContain("pi-pro v0.2.1");
    expect(text).toContain("BUILD");
    expect(text).toContain("pi-pro");
    expect(text).toContain("master");
    expect(text).toContain("node 20");
  });

  it("uses warning color for RO mode badge", () => {
    const segs = buildColoredFooter({ ...baseOpts, mode: "plan", modeReadOnly: true, gitState: "none" });
    const modeSeg = segs.find((s) => s.text === "PLAN RO");
    expect(modeSeg).toBeDefined();
    expect(modeSeg!.color).toBe("warning");
  });

  it("uses success color for build mode", () => {
    const segs = buildColoredFooter({ ...baseOpts, gitState: "clean" });
    const modeSeg = segs.find((s) => s.text === "BUILD");
    expect(modeSeg).toBeDefined();
    expect(modeSeg!.color).toBe("success");
  });

  it("uses danger color for diverged git with icons", () => {
    const segs = buildColoredFooter({ ...baseOpts, gitIcons: "<>1", gitState: "diverged" });
    const dangerSeg = segs.find((s) => s.color === "danger");
    expect(dangerSeg).toBeDefined();
    expect(dangerSeg!.text).toContain("<>1");
  });

  it("uses success color for clean git", () => {
    const segs = buildColoredFooter({ ...baseOpts, gitIcons: "", gitState: "clean" });
    expect(segs.find((s) => s.text === "BUILD")!.color).toBe("success");
  });

  it("uses warning color for modified git", () => {
    const segs = buildColoredFooter({ ...baseOpts, gitIcons: "!2", gitState: "modified" });
    const warnSeg = segs.find((s) => s.color === "warning");
    expect(warnSeg).toBeDefined();
    expect(warnSeg!.text).toContain("!2");
  });

  it("uses info color for ahead", () => {
    const segs = buildColoredFooter({ ...baseOpts, gitIcons: "^1", gitState: "ahead" });
    const infoSeg = segs.find((s) => s.color === "info" && s.text.includes("^1"));
    expect(infoSeg).toBeDefined();
  });

  it("plain text segments have no color", () => {
    const segs = buildColoredFooter({ ...baseOpts, gitState: "clean" });
    const sep = segs.find((s) => s.text === " · ");
    expect(sep).toBeDefined();
  });
});
