import { loadConfig, saveConfig, getConfigPath, getDefaultModes, listModes } from "@pi/config";

export async function plan(action?: string, opts: { configPath?: string } = {}): Promise<void> {
  const path = opts.configPath ?? getConfigPath();
  const config = loadConfig(path);
  const modes = listModes(config.modes ?? getDefaultModes());
  const planMode = modes.find((m) => m.name === "plan");
  if (!planMode) {
    console.error("plan mode not defined in config");
    process.exit(1);
  }
  const isOn = config.agent.name === "plan";
  let next = isOn;
  if (!action || action === "toggle") {
    next = !isOn;
  } else if (action === "on") {
    next = true;
  } else if (action === "off") {
    next = false;
  } else {
    console.error(`unknown action: ${action}`);
    console.error("actions: toggle, on, off");
    process.exit(1);
  }
  const target = next ? "plan" : "build";
  config.agent = { ...config.agent, name: target };
  saveConfig(config, path);
  console.log(`  plan mode: ${next ? "ON (read-only)" : "OFF (build)"}`);
}
