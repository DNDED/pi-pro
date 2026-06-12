import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOrng, resetTheme, currentThemeName } from "../src/theme-write.js";

let tmpHome: string;
let originalHome: string;
let originalXdg: string | undefined;
let originalOverride: string | undefined;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "pi-pro-theme-"));
  originalHome = process.env.HOME ?? "";
  originalXdg = process.env.XDG_CONFIG_HOME;
  originalOverride = process.env.PI_HOME_OVERRIDE;
  process.env.HOME = tmpHome;
  process.env.PI_HOME_OVERRIDE = tmpHome;
  delete process.env.XDG_CONFIG_HOME;
  mkdirSync(join(tmpHome, ".pi", "agent"), { recursive: true });
});

afterEach(() => {
  process.env.HOME = originalHome;
  if (originalXdg !== undefined) process.env.XDG_CONFIG_HOME = originalXdg;
  else delete process.env.XDG_CONFIG_HOME;
  if (originalOverride !== undefined) process.env.PI_HOME_OVERRIDE = originalOverride;
  else delete process.env.PI_HOME_OVERRIDE;
  if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
});

const agentDir = () => join(tmpHome, ".pi", "agent");
const zentuiPath = () => join(agentDir(), "zentui.json");
const piJsonPath = () => join(agentDir(), "pi.json");

function writePiJson(theme?: string) {
  const data: Record<string, unknown> = { version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "build", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } };
  if (theme) data.piPro = { theme };
  writeFileSync(piJsonPath(), JSON.stringify(data));
}

describe("applyOrng", () => {
  it("writes orange colors to zentui.json", () => {
    writePiJson("orng");
    applyOrng("orng");
    const z = JSON.parse(readFileSync(zentuiPath(), "utf8"));
    expect(z.colors.editorAccent).toBe("#EC5B2B");
    expect(z.colors.editorBorder).toBe("#EC5B2B");
    expect(z.colors.editorPrompt).toBe("#EE7948");
    expect(z.colors.editorModel).toBe("#EE7948");
    expect(z.colorSources.editor).toBe("theme");
  });

  it("is a no-op when theme !== orng", () => {
    writePiJson("default");
    applyOrng("default");
    expect(existsSync(zentuiPath())).toBe(false);
  });

  it("preserves unrelated zentui.json keys", () => {
    writePiJson("orng");
    writeFileSync(zentuiPath(), JSON.stringify({
      icons: { cwd: "X", git: "Y" },
      features: { copyFriendly: true, statusLine: false, editor: true },
      colors: { cwd: "old-cwd-color" },
    }));
    applyOrng("orng");
    const z = JSON.parse(readFileSync(zentuiPath(), "utf8"));
    expect(z.icons.cwd).toBe("X");
    expect(z.icons.git).toBe("Y");
    expect(z.features.copyFriendly).toBe(true);
    expect(z.colors.cwd).toBe("old-cwd-color"); // preserved
    expect(z.colors.editorAccent).toBe("#EC5B2B"); // added
  });

  it("is idempotent — re-running writes the same content", () => {
    writePiJson("orng");
    applyOrng("orng");
    const before = readFileSync(zentuiPath(), "utf8");
    applyOrng("orng");
    const after = readFileSync(zentuiPath(), "utf8");
    expect(after).toBe(before);
  });
});

describe("resetTheme", () => {
  it("removes our orange keys but preserves others", () => {
    writePiJson("orng");
    applyOrng("orng");
    writeFileSync(zentuiPath(), JSON.stringify({
      colors: { cwd: "keep-me", editorAccent: "#EC5B2B", editorBorder: "#EC5B2B", editorPrompt: "#EE7948", editorModel: "#EE7948" },
      colorSources: { editor: "theme", starship: "terminal" },
    }));
    resetTheme();
    const z = JSON.parse(readFileSync(zentuiPath(), "utf8"));
    expect(z.colors.editorAccent).toBeUndefined();
    expect(z.colors.editorBorder).toBeUndefined();
    expect(z.colors.editorPrompt).toBeUndefined();
    expect(z.colors.editorModel).toBeUndefined();
    expect(z.colorSources.editor).toBeUndefined();
    expect(z.colors.cwd).toBe("keep-me");
    expect(z.colorSources.starship).toBe("terminal");
  });
});

describe("currentThemeName", () => {
  it("returns 'orng' when no pi.json", () => {
    expect(currentThemeName()).toBe("orng");
  });

  it("returns 'default' when piPro.theme === 'default'", () => {
    writePiJson("default");
    expect(currentThemeName()).toBe("default");
  });

  it("returns 'orng' when piPro.theme === 'orng'", () => {
    writePiJson("orng");
    expect(currentThemeName()).toBe("orng");
  });
});
