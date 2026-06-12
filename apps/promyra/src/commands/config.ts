import { loadConfig, setProvider, setModel, setBaseUrl, setApiKey, getApiKey, type ProviderName, type PromyraConfig } from "@promyra/provider";

const VALID_PROVIDERS: ProviderName[] = ["opencode-go", "anthropic", "openai", "ollama", "openrouter"];

export interface ConfigKeyValidation {
  ok: boolean;
  error?: string;
}

export function validateConfigKey(key: string, value: string | undefined): ConfigKeyValidation {
  if (key === "provider") {
    if (!value || !VALID_PROVIDERS.includes(value as ProviderName)) {
      return { ok: false, error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` };
    }
    return { ok: true };
  }
  if (key === "model" || key === "baseUrl" || key === "apiKey") {
    if (!value) {
      return { ok: false, error: `${key} requires a value` };
    }
    return { ok: true };
  }
  return { ok: false, error: `Unknown config key: ${key}` };
}

export function formatConfigDisplay(cfg: PromyraConfig, apiKey: string | undefined): string {
  const lines: string[] = [];
  lines.push("Current config:");
  lines.push(`  provider: ${cfg.provider}`);
  lines.push(`  model:    ${cfg.model}`);
  if (cfg.baseUrl) lines.push(`  baseUrl:  ${cfg.baseUrl}`);
  lines.push(`  apiKey:   ${apiKey ? `${apiKey.slice(0, 8)}...` : "(not set)"}`);
  return lines.join("\n") + "\n";
}

export async function config(action?: string, key?: string, value?: string): Promise<void> {
  if (!action || action === "show") {
    const cfg = await loadConfig();
    const apiKey = await getApiKey(cfg.provider);
    process.stdout.write(formatConfigDisplay(cfg, apiKey));
    return;
  }

  if (action === "set") {
    if (!key) {
      console.error("Usage: promyra config set <provider|model|apiKey|baseUrl> <value>");
      process.exit(1);
    }
    const v = validateConfigKey(key, value);
    if (!v.ok) {
      console.error(v.error);
      process.exit(1);
    }
    if (key === "provider") {
      const cfg = await setProvider(value as ProviderName);
      console.log(`✓ provider = ${cfg.provider}, model auto-set to ${cfg.model}`);
      return;
    }
    if (key === "model") {
      const cfg = await setModel(value!);
      console.log(`✓ model = ${cfg.model}`);
      return;
    }
    if (key === "baseUrl") {
      const cfg = await setBaseUrl(value!);
      console.log(`✓ baseUrl = ${cfg.baseUrl}`);
      return;
    }
    if (key === "apiKey") {
      const cfg = await loadConfig();
      await setApiKey(cfg.provider, value!);
      console.log(`✓ apiKey set for ${cfg.provider} (stored in ~/.promyra/promyra-auth.json, mode 0600)`);
      return;
    }
  }

  console.error(`Unknown action: ${action}. Try: promyra config, promyra config set <key> <value>`);
  process.exit(1);
}
