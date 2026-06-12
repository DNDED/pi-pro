import { describe, it, expect } from "vitest";
import {
  parsePorcelainLine,
  parsePorcelain,
  formatStatusIcons,
  summarizeGitStatus,
  NERD_FONT_ICONS,
  ASCII_ICONS,
  type GitFile,
} from "../src/util/git-status.js";

const SAMPLE_PORCELAIN = ` M packages/foo/src/index.ts
 M packages/bar/src/index.ts
A  packages/baz/src/new.ts
D  packages/old/src/removed.ts
R  packages/old/src/a.ts -> packages/new/src/a.ts
?? packages/untracked.ts
U  packages/conflict.ts`;

describe("parsePorcelainLine", () => {
  it("parses modified (X=space, Y=M)", () => {
    const f = parsePorcelainLine(" M foo.ts");
    expect(f?.status).toBe("modified");
    expect(f?.path).toBe("foo.ts");
  });

  it("parses untracked (??)", () => {
    const f = parsePorcelainLine("?? untracked.ts");
    expect(f?.status).toBe("untracked");
    expect(f?.path).toBe("untracked.ts");
  });

  it("parses staged add (A)", () => {
    const f = parsePorcelainLine("A  added.ts");
    expect(f?.status).toBe("staged");
    expect(f?.path).toBe("added.ts");
  });

  it("parses deleted (D)", () => {
    const f = parsePorcelainLine(" D deleted.ts");
    expect(f?.status).toBe("deleted");
  });

  it("parses renamed with arrow", () => {
    const f = parsePorcelainLine("R  old.ts -> new.ts");
    expect(f?.status).toBe("renamed");
    expect(f?.origPath).toBe("old.ts");
    expect(f?.path).toBe("new.ts");
  });

  it("parses conflict (U)", () => {
    const f = parsePorcelainLine("U  conflict.ts");
    expect(f?.status).toBe("conflicted");
  });

  it("ignores ignored files", () => {
    const f = parsePorcelainLine("!! ignored.ts");
    expect(f).toBeNull();
  });

  it("returns null for empty line", () => {
    expect(parsePorcelainLine("")).toBeNull();
  });
});

describe("parsePorcelain", () => {
  it("parses all lines", () => {
    const files = parsePorcelain(SAMPLE_PORCELAIN);
    expect(files.length).toBe(7);
    const modified = files.filter((f) => f.status === "modified");
    expect(modified.length).toBe(2);
  });

  it("returns empty for empty input", () => {
    expect(parsePorcelain("")).toEqual([]);
  });
});

describe("formatStatusIcons", () => {
  it("formats Nerd Font icons with counts", () => {
    const files: GitFile[] = [
      { status: "modified", path: "a.ts" },
      { status: "modified", path: "b.ts" },
      { status: "staged", path: "c.ts" },
      { status: "untracked", path: "d.ts" },
    ];
    const out = formatStatusIcons(files, NERD_FONT_ICONS);
    expect(out).toContain("+1");
    expect(out).toContain("!2");
    expect(out).toContain("?1");
  });

  it("uses ASCII icons when nerdFonts=false", () => {
    const files: GitFile[] = [
      { status: "modified", path: "a.ts" },
      { status: "deleted", path: "b.ts" },
    ];
    const out = formatStatusIcons(files, ASCII_ICONS);
    expect(out).toContain("!1");
    expect(out).toContain("X1");
  });

  it("returns empty for clean repo", () => {
    expect(formatStatusIcons([])).toBe("");
  });
});

describe("summarizeGitStatus", () => {
  it("returns full summary with branch + ahead/behind + icons", () => {
    const summary = summarizeGitStatus(SAMPLE_PORCELAIN, "main", 2, 1, true);
    expect(summary.branch).toBe("main");
    expect(summary.ahead).toBe(2);
    expect(summary.behind).toBe(1);
    expect(summary.files.length).toBe(7);
    expect(summary.icons).toContain("!");
  });

  it("falls back to ASCII when nerdFonts=false", () => {
    const summary = summarizeGitStatus(" M foo.ts", "dev", 0, 0, false);
    expect(summary.icons).toContain("!1");
  });
});
