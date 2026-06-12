import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig, type PiConfig } from "../src/index.js";

let tmp: string;
let originalHome: string;
let originalXdg: string | undefined;
let originalOverride: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "pi-pro-cfg-"));
  originalHome = process.env.HOME ?? "";
  originalXdg = process.env.XDG_CONFIG_HOME;
  originalOverride = process.env.PI_HOME_OVERRIDE;
  process.env.HOME = tmp;
  process.env.PI_HOME_OVERRIDE = tmp;
  delete process.env.XDG_CONFIG_HOME;
});

afterEach(() => {
  process.env.HOME = originalHome;
  if (originalXdg !== undefined) process.env.XDG_CONFIG_HOME = originalXdg;
  else delete process.env.XDG_CONFIG_HOME;
  if (originalOverride !== undefined) process.env.PI_HOME_OVERRIDE = originalOverride;
  else delete process.env.PI_HOME_OVERRIDE;
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
});

const baseCfg: PiConfig = {
  version: 1,
  provider: { name: "opencode-go", model: "kimi-k2.6" },
  agent: { name: "build", maxIterations: 10, toolBudget: 6 },
  theme: { name: "default" },
  ui: { statusLine: true, copyFriendly: false, nerdFonts: true, gitStatusIntervalMs: 5000 },
};

describe("saveConfig", () => {
  it("writes config to default path (does not throw in ESM)", () => {
    expect(() => saveConfig(baseCfg)).not.toThrow();
  });

  it("creates the config file on first save", () => {
    saveConfig(baseCfg);
    const cfg = loadConfig();
    expect(cfg.agent.name).toBe("build");
    expect(cfg.provider.model).toBe("kimi-k2.6");
  });

  it("round-trips mode changes (the Tab cycle test)", () => {
    saveConfig(baseCfg);
    expect(loadConfig().agent.name).toBe("build");

    const updated: PiConfig = { ...baseCfg, agent: { ...baseCfg.agent, name: "plan" } };
    saveConfig(updated);
    expect(loadConfig().agent.name).toBe("plan");

    const back: PiConfig = { ...baseCfg, agent: { ...baseCfg.agent, name: "build" } };
    saveConfig(back);
    expect(loadConfig().agent.name).toBe("build");
  });

  it("atomic write via tmp + rename (no partial file)", () => {
    saveConfig(baseCfg);
    const cfgPath = join(tmp, ".pi", "agent", "pi.json");
    expect(existsSync(cfgPath)).toBe(true);
    expect(existsSync(cfgPath + ".tmp")).toBe(false);
  });

  it("rejects invalid config", () => {
    expect(() => saveConfig({ ...baseCfg, provider: { name: "", model: "" } } as PiConfig)).toThrow(/Invalid config/);
  });

  it("creates parent dirs if missing", () => {
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp);
    saveConfig(baseCfg);
    expect(existsSync(join(tmp, ".pi", "agent", "pi.json"))).toBe(true);
  });

  it("preserves file content across save calls", () => {
    saveConfig(baseCfg);
    saveConfig({ ...baseCfg, agent: { ...baseCfg.agent, name: "plan" } });
    const raw = readFileSync(join(tmp, ".pi", "agent", "pi.json"), "utf8");
    expect(raw).toContain('"name": "plan"');
    expect(raw).not.toContain('"name": "build"');
  });
});
