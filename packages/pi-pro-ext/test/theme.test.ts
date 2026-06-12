import { describe, it, expect } from "vitest";
import {
  THEMES,
  getTheme,
  listThemes,
  hexToRgb,
  readColorEnv,
  shouldUseColor,
  paint,
  paintMany,
  type ColorEnv,
} from "../src/theme.js";
import type { PiConfig } from "@pi-pro/config";

describe("theme registry", () => {
  it("ships default, vivid, monokai, noir", () => {
    expect(Object.keys(THEMES).sort()).toEqual(["default", "monokai", "noir", "vivid"]);
  });

  it("each theme has all 6 color tokens with valid hex", () => {
    for (const theme of Object.values(THEMES)) {
      for (const c of ["accent", "muted", "success", "warning", "danger", "info"] as const) {
        expect(theme.tokens[c], `${theme.name}.${c} exists`).toBeDefined();
        expect(theme.tokens[c]!.hex, `${theme.name}.${c}.hex valid`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe("getTheme", () => {
  it("returns named theme", () => {
    expect(getTheme("vivid").name).toBe("vivid");
    expect(getTheme("monokai").name).toBe("monokai");
  });

  it("falls back to default for unknown name", () => {
    expect(getTheme("nonexistent").name).toBe("default");
    expect(getTheme(undefined).name).toBe("default");
    expect(getTheme("").name).toBe("default");
  });
});

describe("listThemes", () => {
  it("returns all themes", () => {
    expect(listThemes().length).toBe(Object.keys(THEMES).length);
    expect(listThemes().map((t) => t.name).sort()).toEqual(["default", "monokai", "noir", "vivid"]);
  });
});

describe("hexToRgb", () => {
  it("parses #rrggbb", () => {
    expect(hexToRgb("#22d3ee")).toEqual({ r: 0x22, g: 0xd3, b: 0xee });
    expect(hexToRgb("ff0000")).toEqual({ r: 0xff, g: 0, b: 0 });
  });

  it("falls back to grey for invalid", () => {
    expect(hexToRgb("not a color")).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe("readColorEnv", () => {
  it("detects NO_COLOR", () => {
    expect(readColorEnv({ NO_COLOR: "1" }, null).noColor).toBe(true);
  });
  it("detects TERM=dumb", () => {
    expect(readColorEnv({ TERM: "dumb" }, null).termDumb).toBe(true);
  });
  it("detects copyFriendly in config", () => {
    const cfg = { ui: { copyFriendly: true, statusLine: true, nerdFonts: true, gitStatusIntervalMs: 5000 } } as unknown as PiConfig;
    expect(readColorEnv({}, cfg).copyFriendly).toBe(true);
  });
  it("copyFriendly false by default", () => {
    expect(readColorEnv({}, null).copyFriendly).toBe(false);
  });
});

describe("shouldUseColor", () => {
  const allow: ColorEnv = { noColor: false, termDumb: false, copyFriendly: false, noTty: false };
  it("allows when all conditions clean", () => {
    expect(shouldUseColor(allow)).toBe(true);
  });
  it("blocks on NO_COLOR", () => {
    expect(shouldUseColor({ ...allow, noColor: true })).toBe(false);
  });
  it("blocks on TERM=dumb", () => {
    expect(shouldUseColor({ ...allow, termDumb: true })).toBe(false);
  });
  it("blocks on copyFriendly", () => {
    expect(shouldUseColor({ ...allow, copyFriendly: true })).toBe(false);
  });
  it("blocks on no tty", () => {
    expect(shouldUseColor({ ...allow, noTty: true })).toBe(false);
  });
});

describe("paint", () => {
  const theme = THEMES.vivid!;
  it("returns plain text when color disabled", () => {
    expect(paint("hi", "accent", theme, false)).toBe("hi");
  });
  it("emits ANSI 24-bit when color enabled", () => {
    const out = paint("hi", "accent", theme, true);
    expect(out).toMatch(/^\x1b\[1m\x1b\[38;2;167;139;250mhi\x1b\[0m$/);
  });
  it("non-bold token has no bold prefix", () => {
    const out = paint("ok", "muted", theme, true);
    expect(out).toMatch(/^\x1b\[38;2;161;161;170mok\x1b\[0m$/);
  });
  it("falls back to plain for missing token", () => {
    const broken: typeof theme = { ...theme, tokens: { ...theme.tokens, accent: undefined! } };
    expect(paint("x", "accent", broken, true)).toBe("x");
  });
});

describe("paintMany", () => {
  it("joins colored + plain segments", () => {
    const theme = THEMES.vivid!;
    const out = paintMany(
      [
        { text: "pi-pro", color: "accent" },
        { text: " v0.2.1 " },
        { text: "build", color: "success" },
      ],
      theme,
      true,
    );
    expect(out).toContain("pi-pro");
    expect(out).toContain("v0.2.1");
    expect(out).toContain("build");
    expect(out).toContain("\x1b[");
  });
  it("skips colors when disabled", () => {
    const out = paintMany(
      [{ text: "a", color: "accent" }, { text: "b" }],
      THEMES.vivid!,
      false,
    );
    expect(out).toBe("ab");
  });
});
