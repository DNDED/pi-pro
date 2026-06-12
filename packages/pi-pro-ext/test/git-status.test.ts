import { describe, it, expect } from "vitest";
import {
  parsePorcelainLine,
  parsePorcelain,
  formatStatusIcons,
  summarizeGitStatus,
  NERD_FONT_ICONS,
  ASCII_ICONS,
} from "../src/util/git-status.js";

const SAMPLE = ` M packages/foo/src/index.ts
 M packages/bar/src/index.ts
A  packages/baz/src/new.ts
D  packages/old/src/removed.ts
R  packages/old/src/a.ts -> packages/new/src/a.ts
?? packages/untracked.ts
U  packages/conflict.ts`;

describe("parsePorcelainLine", () => {
  it("parses modified (X=space, Y=M)", () => {
    expect(parsePorcelainLine(" M foo.ts")?.status).toBe("modified");
  });
  it("parses untracked (??)", () => {
    expect(parsePorcelainLine("?? untracked.ts")?.status).toBe("untracked");
  });
  it("parses staged add (A)", () => {
    expect(parsePorcelainLine("A  added.ts")?.status).toBe("staged");
  });
  it("parses deleted (D)", () => {
    expect(parsePorcelainLine(" D deleted.ts")?.status).toBe("deleted");
  });
  it("parses renamed with arrow", () => {
    const f = parsePorcelainLine("R  old.ts -> new.ts");
    expect(f?.status).toBe("renamed");
    expect(f?.origPath).toBe("old.ts");
    expect(f?.path).toBe("new.ts");
  });
  it("parses conflict (U)", () => {
    expect(parsePorcelainLine("U  conflict.ts")?.status).toBe("conflicted");
  });
  it("ignores ignored", () => {
    expect(parsePorcelainLine("!! ignored.ts")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(parsePorcelainLine("")).toBeNull();
  });
});

describe("parsePorcelain", () => {
  it("parses all lines", () => {
    expect(parsePorcelain(SAMPLE).length).toBe(7);
  });
  it("returns empty for empty", () => {
    expect(parsePorcelain("")).toEqual([]);
  });
});

describe("formatStatusIcons", () => {
  it("formats Nerd Font icons with counts", () => {
    const out = formatStatusIcons([
      { status: "modified", path: "a" },
      { status: "modified", path: "b" },
      { status: "staged", path: "c" },
      { status: "untracked", path: "d" },
    ], NERD_FONT_ICONS);
    expect(out).toContain("+1");
    expect(out).toContain("!2");
    expect(out).toContain("?1");
  });
  it("uses ASCII icons when nerdFonts=false", () => {
    const out = formatStatusIcons([
      { status: "modified", path: "a" },
      { status: "deleted", path: "b" },
    ], ASCII_ICONS);
    expect(out).toContain("!1");
    expect(out).toContain("X1");
  });
  it("empty for clean repo", () => {
    expect(formatStatusIcons([])).toBe("");
  });
});

describe("summarizeGitStatus", () => {
  it("returns full summary", () => {
    const s = summarizeGitStatus(SAMPLE, "main", 2, 1, true);
    expect(s.branch).toBe("main");
    expect(s.ahead).toBe(2);
    expect(s.behind).toBe(1);
    expect(s.files.length).toBe(7);
    expect(s.icons).toContain("!");
  });
  it("ASCII when nerdFonts=false", () => {
    const s = summarizeGitStatus(" M foo.ts", "dev", 0, 0, false);
    expect(s.icons).toContain("!1");
  });
});
