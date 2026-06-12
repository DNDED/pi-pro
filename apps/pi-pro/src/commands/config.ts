import {
  loadConfig,
  saveConfig,
  getConfigPath,
  applyEnvOverrides,
  validateConfig,
  type PiConfig,
} from "@pi/config";

function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function show(config: PiConfig, path: string): void {
  console.log("pi config");
  console.log("─".repeat(40));
  console.log(`  path:      ${path}`);
  console.log(`  version:   ${config.version}`);
  console.log(`  provider:  ${config.provider.name}`);
  console.log(`  model:     ${config.provider.model}`);
  if (config.provider.baseUrl) console.log(`  baseUrl:   ${config.provider.baseUrl}`);
  console.log(`  agent:     ${config.agent.name}`);
  console.log(`  max iter:  ${config.agent.maxIterations}`);
  console.log(`  tool budget: ${config.agent.toolBudget}`);
  console.log(`  theme:     ${config.theme.name}`);
  if (config.swarm) {
    console.log(`  swarm budget: $${config.swarm.defaultBudgetUsd.toFixed(2)}`);
    console.log(`  swarm retries: ${config.swarm.defaultRetries}`);
  }
  if (config.context) {
    console.log(`  context embeddings: ${config.context.embeddings}`);
    console.log(`  context compression: ${config.context.compression}`);
    console.log(`  context query k: ${config.context.memoryQueryK}`);
  }
  if (config.ui) {
    console.log(`  ui editor: ${config.ui.editor}`);
    console.log(`  ui statusline: ${config.ui.statusLine}`);
    console.log(`  ui copy-friendly: ${config.ui.copyFriendly}`);
    console.log(`  ui nerdFonts: ${config.ui.nerdFonts}`);
  }
  if (config.modes) {
    console.log(`  modes: ${config.modes.map((m) => m.name).join(", ")}`);
  }
}

function setKey(config: PiConfig, key: string, value: string): PiConfig {
  const path = key.split(".");
  if (path.length === 1) {
    if (key === "agent") return { ...config, agent: { ...config.agent, name: value } };
    if (key === "model") return { ...config, provider: { ...config.provider, model: value } };
    if (key === "theme") return { ...config, theme: { ...config.theme, name: value } };
    throw new Error(`unknown top-level key: ${key} (try 'model' or 'agent')`);
  }
  if (path[0] === "ui" && path[1] === "copyFriendly") {
    return { ...config, ui: { ...(config.ui ?? { editor: true, statusLine: true, copyFriendly: false, nerdFonts: true, icons: {}, colors: {}, gitStatusIntervalMs: 5000 }), copyFriendly: value === "true" || value === "1" } };
  }
  if (path[0] === "ui" && path[1] === "statusLine") {
    return { ...config, ui: { ...(config.ui ?? { editor: true, statusLine: true, copyFriendly: false, nerdFonts: true, icons: {}, colors: {}, gitStatusIntervalMs: 5000 }), statusLine: value === "true" || value === "1" } };
  }
  if (path[0] === "ui" && path[1] === "nerdFonts") {
    return { ...config, ui: { ...(config.ui ?? { editor: true, statusLine: true, copyFriendly: false, nerdFonts: true, icons: {}, colors: {}, gitStatusIntervalMs: 5000 }), nerdFonts: value === "true" || value === "1" } };
  }
  throw new Error(`unsupported dotted key: ${key}`);
}

function unsetKey(config: PiConfig, key: string): PiConfig {
  if (key === "provider.baseUrl") {
    const { baseUrl: _baseUrl, ...rest } = config.provider;
    void _baseUrl;
    return { ...config, provider: rest };
  }
  throw new Error(`unset not supported for key: ${key}`);
}

export async function config(action?: string, key?: string, value?: string, opts: { configPath?: string } = {}): Promise<void> {
  const path = opts.configPath ?? getConfigPath();
  const fileConfig = loadConfig(path);
  const env = { ...process.env };
  const config = applyEnvOverrides(fileConfig, env);

  if (!action || action === "show") {
    show(config, path);
    return;
  }
  if (action === "path") {
    console.log(path);
    return;
  }
  if (action === "reset") {
    saveConfig({ ...config, version: 1 }, path);
    console.log("  reset to defaults");
    return;
  }
  if (action === "set") {
    if (!key || value === undefined) {
      console.error("usage: pi config set <key> <value>");
      console.error("  e.g. pi config set model gpt-4o");
      console.error("  e.g. pi config set ui.copyFriendly true");
      process.exit(1);
    }
    const next = setKey(config, key, value);
    const result = validateConfig(next);
    if (!result.ok) {
      console.error(`  invalid: ${result.errors.join("; ")}`);
      process.exit(1);
    }
    saveConfig(result.config, path);
    console.log(`  set ${key} = ${value}`);
    return;
  }
  if (action === "unset") {
    if (!key) {
      console.error("usage: pi config unset <key>");
      process.exit(1);
    }
    const next = unsetKey(config, key);
    saveConfig(next, path);
    console.log(`  unset ${key}`);
    return;
  }
  console.error(`unknown action: ${action}`);
  console.error("actions: show, set, unset, reset, path");
  process.exit(1);
}

void maskSecret;
