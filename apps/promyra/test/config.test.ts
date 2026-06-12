import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatConfigDisplay, validateConfigKey, config } from "../src/commands/config.js";
import type { PromyraConfig } from "@promyra/provider";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "config-home-"));
  process.env.PROMYRA_HOME_OVERRIDE = home;
});
afterEach(async () => {
  delete process.env.PROMYRA_HOME_OVERRIDE;
  await rm(home, { recursive: true, force: true });
});

function captureStdout(fn: () => Promise<void> | void): Promise<string> {
  const origWrite = process.stdout.write.bind(process.stdout);
  const origLog = console.log;
  let buf = "";
  (process.stdout as any).write = (chunk: string | Buffer) => {
    buf += chunk.toString();
    return true;
  };
  console.log = (...args: unknown[]) => {
    buf += args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ") + "\n";
  };
  return Promise.resolve(fn()).finally(() => {
    (process.stdout as any).write = origWrite;
    console.log = origLog;
    return Promise.resolve();
  }).then(() => buf);
}

describe("formatConfigDisplay", () => {
  it("shows the provider line", () => {
    const out = formatConfigDisplay({ provider: "opencode-go", model: "minimax-m3" } as PromyraConfig, undefined);
    expect(out).toContain("provider: opencode-go");
  });

  it("shows the model line", () => {
    const out = formatConfigDisplay({ provider: "opencode-go", model: "minimax-m3" } as PromyraConfig, undefined);
    expect(out).toContain("model:");
    expect(out).toContain("minimax-m3");
  });

  it("shows baseUrl when set", () => {
    const out = formatConfigDisplay({
      provider: "opencode-go",
      model: "minimax-m3",
      baseUrl: "https://example.test/v1",
    } as PromyraConfig, undefined);
    expect(out).toContain("baseUrl:");
    expect(out).toContain("https://example.test/v1");
  });

  it("omits baseUrl line when not set", () => {
    const out = formatConfigDisplay({ provider: "opencode-go", model: "minimax-m3" } as PromyraConfig, undefined);
    expect(out).not.toContain("baseUrl");
  });

  it("masks an apiKey showing only the first 8 chars + ellipsis", () => {
    const out = formatConfigDisplay(
      { provider: "opencode-go", model: "minimax-m3" } as PromyraConfig,
      "sk-abcde1234567890",
    );
    expect(out).toContain("sk-abcde...");
    expect(out).not.toContain("1234567890");
  });

  it("shows (not set) when no apiKey", () => {
    const out = formatConfigDisplay({ provider: "opencode-go", model: "minimax-m3" } as PromyraConfig, undefined);
    expect(out).toContain("(not set)");
  });

  it("masks a short apiKey without crashing", () => {
    const out = formatConfigDisplay(
      { provider: "opencode-go", model: "minimax-m3" } as PromyraConfig,
      "short",
    );
    expect(out).toContain("short...");
  });
});

describe("validateConfigKey", () => {
  it("rejects an unknown key", () => {
    const r = validateConfigKey("bogus", "v");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Unknown/);
  });

  it("rejects an invalid provider name", () => {
    const r = validateConfigKey("provider", "wat");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Invalid provider/);
  });

  it("accepts all 5 valid provider names", () => {
    for (const v of ["opencode-go", "anthropic", "openai", "ollama", "openrouter"]) {
      expect(validateConfigKey("provider", v).ok).toBe(true);
    }
  });

  it("requires a value for set", () => {
    expect(validateConfigKey("model", undefined).ok).toBe(false);
    expect(validateConfigKey("apiKey", undefined).ok).toBe(false);
    expect(validateConfigKey("baseUrl", undefined).ok).toBe(false);
    expect(validateConfigKey("model", "").ok).toBe(false);
  });

  it("accepts model/baseUrl/apiKey with a value", () => {
    expect(validateConfigKey("model", "gpt-x").ok).toBe(true);
    expect(validateConfigKey("baseUrl", "https://x").ok).toBe(true);
    expect(validateConfigKey("apiKey", "sk-abc").ok).toBe(true);
  });
});

describe("config orchestrator", () => {
  it("with no action, prints the current config", async () => {
    const out = await captureStdout(() => config());
    expect(out).toMatch(/provider:/);
  });

  it("with action=show, prints the current config", async () => {
    const out = await captureStdout(() => config("show"));
    expect(out).toMatch(/provider:/);
  });

  it("with set <key> <value> and a valid model, writes model to config and prints confirmation", async () => {
    const out = await captureStdout(() => config("set", "model", "gpt-5-test"));
    expect(out).toContain("✓ model = gpt-5-test");
    const raw = await readFile(join(home, ".promyra", "promyra-config.json"), "utf8");
    const cfg = JSON.parse(raw);
    expect(cfg.model).toBe("gpt-5-test");
  });

  it("with set provider <name>, switches provider and sets default model", async () => {
    const out = await captureStdout(() => config("set", "provider", "anthropic"));
    expect(out).toMatch(/✓ provider = anthropic/);
    expect(out).toMatch(/model auto-set/);
  });

  it("with set baseUrl <url>, writes baseUrl to config", async () => {
    const out = await captureStdout(() => config("set", "baseUrl", "https://x.test/v1"));
    expect(out).toContain("✓ baseUrl = https://x.test/v1");
  });

  it("with set apiKey <key>, writes auth to auth.json", async () => {
    const out = await captureStdout(() => config("set", "apiKey", "sk-test-12345"));
    expect(out).toMatch(/✓ apiKey set/);
    const raw = await readFile(join(home, ".promyra", "promyra-auth.json"), "utf8");
    const all = JSON.parse(raw);
    expect(all["opencode-go"]).toBe("sk-test-12345");
  });
});
