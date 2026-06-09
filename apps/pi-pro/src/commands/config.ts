import { loadConfig, setProvider, setModel, setBaseUrl, setApiKey, getApiKey, type ProviderName } from "@pi/provider";

const VALID_PROVIDERS: ProviderName[] = ["opencode-go", "anthropic", "openai", "ollama", "openrouter"];

export async function config(action?: string, key?: string, value?: string): Promise<void> {
  if (!action || action === "show") {
    const cfg = await loadConfig();
    console.log("Current config:");
    console.log(`  provider: ${cfg.provider}`);
    console.log(`  model:    ${cfg.model}`);
    if (cfg.baseUrl) console.log(`  baseUrl:  ${cfg.baseUrl}`);
    const apiKey = await getApiKey(cfg.provider);
    console.log(`  apiKey:   ${apiKey ? `${apiKey.slice(0, 8)}...` : "(not set)"}`);
    return;
  }

  if (action === "set") {
    if (!key) {
      console.error("Usage: pi-pro config set <provider|model|apiKey|baseUrl> <value>");
      process.exit(1);
    }
    if (key === "provider") {
      if (!value || !VALID_PROVIDERS.includes(value as ProviderName)) {
        console.error(`Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`);
        process.exit(1);
      }
      const cfg = await setProvider(value as ProviderName);
      console.log(`✓ provider = ${cfg.provider}, model auto-set to ${cfg.model}`);
      return;
    }
    if (key === "model") {
      if (!value) { console.error("model requires a value"); process.exit(1); }
      const cfg = await setModel(value);
      console.log(`✓ model = ${cfg.model}`);
      return;
    }
    if (key === "baseUrl") {
      if (!value) { console.error("baseUrl requires a value"); process.exit(1); }
      const cfg = await setBaseUrl(value);
      console.log(`✓ baseUrl = ${cfg.baseUrl}`);
      return;
    }
    if (key === "apiKey") {
      if (!value) { console.error("apiKey requires a value"); process.exit(1); }
      const cfg = await loadConfig();
      await setApiKey(cfg.provider, value);
      console.log(`✓ apiKey set for ${cfg.provider} (stored in ~/.pi/agent/pi-pro-auth.json, mode 0600)`);
      return;
    }
    console.error(`Unknown config key: ${key}`);
    process.exit(1);
  }

  console.error(`Unknown action: ${action}. Try: pi-pro config, pi-pro config set <key> <value>`);
  process.exit(1);
}
