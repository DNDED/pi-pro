import { describe, it, expect } from "vitest";
import { loadConfig, DEFAULT_CONFIG, type PiConfig } from "../src/index.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function tmpFile(name: string): string {
  const dir = join(tmpdir(), `pi-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

describe("loadConfig", () => {
  it("returns defaults when file is missing", () => {
    const path = tmpFile("nope.json");
    const cfg = loadConfig(path);
    expect(cfg.version).toBe(1);
    expect(cfg.provider.name).toBe(DEFAULT_CONFIG.provider.name);
  });

  it("reads valid JSON config from path", () => {
    const path = tmpFile("cfg.json");
    const written: PiConfig = {
      ...DEFAULT_CONFIG,
      provider: { name: "openai", model: "gpt-4o" },
    };
    writeFileSync(path, JSON.stringify(written), "utf8");
    const cfg = loadConfig(path);
    expect(cfg.provider.name).toBe("openai");
    expect(cfg.provider.model).toBe("gpt-4o");
  });

  it("falls back to defaults if file is corrupted", () => {
    const path = tmpFile("bad.json");
    writeFileSync(path, "{ not valid json", "utf8");
    const cfg = loadConfig(path);
    expect(cfg.version).toBe(1);
  });

  it("does not throw on missing cwd permissions (graceful fallback)", () => {
    const cfg = loadConfig("/nonexistent/path/that/does/not/exist.json");
    expect(cfg.version).toBe(1);
  });
});
