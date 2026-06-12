import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { saveConfig, loadConfig, DEFAULT_CONFIG } from "../src/index.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";

function tmpDir(): string {
  const dir = join(tmpdir(), `pi-config-save-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("saveConfig", () => {
  let dir: string;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("writes a valid config file", () => {
    const path = join(dir, "pi.json");
    const cfg = { ...DEFAULT_CONFIG, provider: { ...DEFAULT_CONFIG.provider, model: "gpt-4o" } };
    saveConfig(cfg, path);
    expect(existsSync(path)).toBe(true);
    const round = JSON.parse(readFileSync(path, "utf8"));
    expect(round.provider.model).toBe("gpt-4o");
  });

  it("round-trips through loadConfig", () => {
    const path = join(dir, "pi.json");
    const cfg = { ...DEFAULT_CONFIG, agent: { ...DEFAULT_CONFIG.agent, name: "plan" } };
    saveConfig(cfg, path);
    const loaded = loadConfig(path);
    expect(loaded.agent.name).toBe("plan");
  });

  it("uses atomic write (temp + rename), no partial files", () => {
    const path = join(dir, "pi.json");
    const cfg = { ...DEFAULT_CONFIG, version: 1 as const };
    saveConfig(cfg, path);
    const leftover = join(dir, "pi.json.tmp");
    expect(existsSync(leftover)).toBe(false);
  });
});
