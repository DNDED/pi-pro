import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freeCtrlP } from "../src/keybindings-write.js";

let tmpHome: string;
let originalHome: string;
let originalXdg: string | undefined;
let originalOverride: string | undefined;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "pi-pro-kb-"));
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

const kbPath = () => join(tmpHome, ".pi", "agent", "keybindings.json");

describe("freeCtrlP", () => {
  it("creates keybindings.json with our re-bind when none exists", () => {
    const r = freeCtrlP();
    expect(r.wrote).toBe(true);
    expect(existsSync(kbPath())).toBe(true);
    const json = JSON.parse(readFileSync(kbPath(), "utf8"));
    expect(json["app.model.cycleForward"]).toEqual(["f2"]);
    expect(json["app.session.togglePath"]).toEqual(["f2"]);
    expect(json["app.models.toggleProvider"]).toEqual(["f2"]);
  });

  it("is idempotent — re-running is a no-op", () => {
    freeCtrlP();
    const r2 = freeCtrlP();
    expect(r2.wrote).toBe(false);
  });

  it("preserves unrelated keybindings the user has set", () => {
    writeFileSync(kbPath(), JSON.stringify({
      "app.interrupt": ["ctrl+x"],
      "app.exit": ["ctrl+q"],
    }));
    const r = freeCtrlP();
    expect(r.wrote).toBe(true);
    const json = JSON.parse(readFileSync(kbPath(), "utf8"));
    expect(json["app.interrupt"]).toEqual(["ctrl+x"]);
    expect(json["app.exit"]).toEqual(["ctrl+q"]);
    expect(json["app.model.cycleForward"]).toEqual(["f2"]);
  });

  it("overrides user's existing model.cycleForward binding", () => {
    writeFileSync(kbPath(), JSON.stringify({
      "app.model.cycleForward": ["f3"],
    }));
    freeCtrlP();
    const json = JSON.parse(readFileSync(kbPath(), "utf8"));
    expect(json["app.model.cycleForward"]).toEqual(["f2"]); // ours wins
  });
});
