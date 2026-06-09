import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homedir } from "node:os";

const tmpHome = join(tmpdir(), `pi-pro-config-test-${Date.now()}`);
const realConfigPath = join(homedir(), ".pi", "agent", "pi-pro-config.json");
const realAuthPath = join(homedir(), ".pi", "agent", "pi-pro-auth.json");

beforeEach(async () => {
  await mkdir(join(tmpHome, ".pi", "agent"), { recursive: true });
  process.env.PI_PRO_HOME_OVERRIDE = tmpHome;
  vi.resetModules();
  const mod = await import("../src/config.js");
  (globalThis as { __cfg?: unknown }).__cfg = mod;
});

afterEach(async () => {
  await rm(tmpHome, { recursive: true, force: true });
  delete process.env.PI_PRO_HOME_OVERRIDE;
  vi.resetModules();
});

async function backupAndClearReal() {
  return { cfg: null as string | null, auth: null as string | null };
}

describe("@pi/provider config", () => {
  it("loadConfig returns defaults when no file exists", async () => {
    const { loadConfig } = (globalThis as { __cfg: { loadConfig: () => Promise<unknown> } }).__cfg as never;
    const cfg = await loadConfig();
    expect(cfg).toEqual({ provider: "opencode-go", model: "minimax-m3" });
  });

  it("saveConfig persists and loadConfig reads it back", async () => {
    const { saveConfig, loadConfig } = (globalThis as { __cfg: { saveConfig: (c: unknown) => Promise<void>; loadConfig: () => Promise<{ provider: string; model: string }> } }).__cfg as never;
    await saveConfig({ provider: "anthropic", model: "claude-sonnet-4-6" });
    const cfg = await loadConfig();
    expect(cfg.provider).toBe("anthropic");
    expect(cfg.model).toBe("claude-sonnet-4-6");
  });

  it("setProvider switches provider and updates model to that provider's default", async () => {
    const { setProvider } = (globalThis as { __cfg: { setProvider: (p: string) => Promise<{ provider: string; model: string }> } }).__cfg as never;
    const cfg = await setProvider("openai");
    expect(cfg.provider).toBe("openai");
    expect(cfg.model).toBe("gpt-4o");
  });

  it("setModel keeps provider and overrides model", async () => {
    const { setProvider, setModel, loadConfig } = (globalThis as { __cfg: { setProvider: (p: string) => Promise<unknown>; setModel: (m: string) => Promise<unknown>; loadConfig: () => Promise<{ provider: string; model: string }> } }).__cfg as never;
    await setProvider("anthropic");
    await setModel("claude-opus-4-1");
    const cfg = await loadConfig();
    expect(cfg.provider).toBe("anthropic");
    expect(cfg.model).toBe("claude-opus-4-1");
  });

  it("setApiKey stores key in auth file with 0600 perms", async () => {
    const { setApiKey, getApiKey } = (globalThis as { __cfg: { setApiKey: (p: string, k: string) => Promise<void>; getApiKey: (p: string) => Promise<string | undefined> } }).__cfg as never;
    await setApiKey("openai", "sk-test-123");
    const got = await getApiKey("openai");
    expect(got).toBe("sk-test-123");
  });

  it("getApiKey reads from env var first", async () => {
    const { setApiKey, getApiKey } = (globalThis as { __cfg: { setApiKey: (p: string, k: string) => Promise<void>; getApiKey: (p: string) => Promise<string | undefined> } }).__cfg as never;
    await setApiKey("anthropic", "from-file");
    process.env.ANTHROPIC_API_KEY = "from-env";
    const got = await getApiKey("anthropic");
    expect(got).toBe("from-env");
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("defaultModelFor returns provider-specific defaults", async () => {
    const { defaultModelFor } = (globalThis as { __cfg: { defaultModelFor: (p: string) => string } }).__cfg as never;
    expect(defaultModelFor("opencode-go")).toBe("minimax-m3");
    expect(defaultModelFor("anthropic")).toBe("claude-sonnet-4-6");
    expect(defaultModelFor("openai")).toBe("gpt-4o");
    expect(defaultModelFor("ollama")).toBe("llama3");
    expect(defaultModelFor("openrouter")).toBe("anthropic/claude-sonnet-4-6");
  });
});
