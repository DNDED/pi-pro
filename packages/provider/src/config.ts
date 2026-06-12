import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export type ProviderName = "opencode-go" | "anthropic" | "openai" | "ollama" | "openrouter";

export interface PromyraConfig {
  provider: ProviderName;
  model: string;
  baseUrl?: string;
}

const DEFAULT_CONFIG: PromyraConfig = {
  provider: "opencode-go",
  model: "deepseek-v4-flash",
};

const DEFAULT_MODELS: Record<ProviderName, string> = {
  "opencode-go": "deepseek-v4-flash",
  "anthropic": "claude-sonnet-4-6",
  "openai": "gpt-4o",
  "ollama": "llama3",
  "openrouter": "anthropic/claude-sonnet-4-6",
};

export const DEFAULT_CONFIG_PATH = join(homedir(), ".promyra", "promyra-config.json");
export const DEFAULT_AUTH_PATH = join(homedir(), ".promyra", "promyra-auth.json");

export function defaultModelFor(provider: ProviderName): string {
  return DEFAULT_MODELS[provider];
}

function resolveHome(): string {
  return process.env.PROMYRA_HOME_OVERRIDE ?? homedir();
}

function configPath(path?: string): string {
  return path ?? join(resolveHome(), ".promyra", "promyra-config.json");
}

function authPath(path?: string): string {
  return path ?? join(resolveHome(), ".promyra", "promyra-auth.json");
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

export async function loadConfig(path?: string): Promise<PromyraConfig> {
  const p = configPath(path);
  if (!existsSync(p)) return { ...DEFAULT_CONFIG };
  const raw = await readFile(p, "utf8");
  return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<PromyraConfig>) };
}

export async function saveConfig(cfg: PromyraConfig, path?: string): Promise<void> {
  const p = configPath(path);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

export async function setProvider(provider: ProviderName, path?: string): Promise<PromyraConfig> {
  const cfg = await loadConfig(path);
  cfg.provider = provider;
  cfg.model = defaultModelFor(provider);
  await saveConfig(cfg, path);
  return cfg;
}

export async function setModel(model: string, path?: string): Promise<PromyraConfig> {
  const cfg = await loadConfig(path);
  cfg.model = model;
  await saveConfig(cfg, path);
  return cfg;
}

export async function setBaseUrl(baseUrl: string, path?: string): Promise<PromyraConfig> {
  const cfg = await loadConfig(path);
  cfg.baseUrl = baseUrl;
  await saveConfig(cfg, path);
  return cfg;
}

export async function getApiKey(provider: ProviderName, path?: string): Promise<string | undefined> {
  const envKey = providerToEnvVar(provider);
  if (process.env[envKey]) return process.env[envKey];
  const p = authPath(path);
  if (!existsSync(p)) return undefined;
  const raw = await readFile(p, "utf8");
  const all = JSON.parse(raw) as Record<string, string>;
  return all[provider];
}

export async function setApiKey(provider: ProviderName, apiKey: string, path?: string): Promise<void> {
  const p = authPath(path);
  await mkdir(dirname(p), { recursive: true });
  let all: Record<string, string> = {};
  if (existsSync(p)) {
    all = JSON.parse(await readFile(p, "utf8"));
  }
  all[provider] = apiKey;
  await writeFile(p, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
}
