import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export type ProviderName = "opencode-go" | "anthropic" | "openai" | "ollama" | "openrouter";

export interface PiProConfig {
  provider: ProviderName;
  model: string;
  baseUrl?: string;
}

const DEFAULT_CONFIG: PiProConfig = {
  provider: "opencode-go",
  model: "minimax-m3",
};

const DEFAULT_MODELS: Record<ProviderName, string> = {
  "opencode-go": "minimax-m3",
  "anthropic": "claude-sonnet-4-6",
  "openai": "gpt-4o",
  "ollama": "llama3",
  "openrouter": "anthropic/claude-sonnet-4-6",
};

export function defaultModelFor(provider: ProviderName): string {
  return DEFAULT_MODELS[provider];
}

function configPath(): string {
  return join(resolveHome(), ".pi", "agent", "pi-pro-config.json");
}

function authPath(): string {
  return join(resolveHome(), ".pi", "agent", "pi-pro-auth.json");
}

function resolveHome(): string {
  return process.env.PI_PRO_HOME_OVERRIDE ?? homedir();
}

function providerToEnvVar(provider: ProviderName): string {
  switch (provider) {
    case "opencode-go": return "OPENCODE_GO_API_KEY";
    case "anthropic": return "ANTHROPIC_API_KEY";
    case "openai": return "OPENAI_API_KEY";
    case "ollama": return "OLLAMA_API_KEY";
    case "openrouter": return "OPENROUTER_API_KEY";
  }
}

function readEnvApiKey(provider: ProviderName): string | undefined {
  return process.env[providerToEnvVar(provider)];
}

export async function loadConfig(): Promise<PiProConfig> {
  const path = configPath();
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const raw = await readFile(path, "utf8");
  return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<PiProConfig>) };
}

export async function saveConfig(cfg: PiProConfig): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

export async function setProvider(provider: ProviderName): Promise<PiProConfig> {
  const cfg = await loadConfig();
  cfg.provider = provider;
  cfg.model = defaultModelFor(provider);
  await saveConfig(cfg);
  return cfg;
}

export async function setModel(model: string): Promise<PiProConfig> {
  const cfg = await loadConfig();
  cfg.model = model;
  await saveConfig(cfg);
  return cfg;
}

export async function setBaseUrl(baseUrl: string): Promise<PiProConfig> {
  const cfg = await loadConfig();
  cfg.baseUrl = baseUrl;
  await saveConfig(cfg);
  return cfg;
}

export async function getApiKey(provider: ProviderName): Promise<string | undefined> {
  const envKey = providerToEnvVar(provider);
  if (process.env[envKey]) return process.env[envKey];
  const path = authPath();
  if (!existsSync(path)) return undefined;
  const raw = await readFile(path, "utf8");
  const all = JSON.parse(raw) as Record<string, string>;
  return all[provider];
}

export async function setApiKey(provider: ProviderName, apiKey: string): Promise<void> {
  const path = authPath();
  await mkdir(dirname(path), { recursive: true });
  let all: Record<string, string> = {};
  if (existsSync(path)) {
    all = JSON.parse(await readFile(path, "utf8"));
  }
  all[provider] = apiKey;
  await writeFile(path, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
}
