import { loadConfig, getConfigPath, getDefaultModes, cycleMode, getNextMode, listModes } from "@pi/config";

export async function mode(action?: string, name?: string, opts: { configPath?: string } = {}): Promise<void> {
  const path = opts.configPath ?? getConfigPath();
  const config = loadConfig(path);
  const modes = listModes(config.modes ?? getDefaultModes());
  const current = config.agent.name;

  if (!action || action === "show") {
    console.log(`mode: ${current}`);
    console.log("available:");
    for (const m of modes) {
      const marker = m.name === current ? "*" : " ";
      console.log(`  ${marker} ${m.name.padEnd(12)} ${m.label}${m.readOnly ? " (read-only)" : ""}`);
    }
    return;
  }
  if (action === "list") {
    for (const m of modes) {
      console.log(`  ${m.name}  ${m.label}${m.readOnly ? " (read-only)" : ""}`);
    }
    return;
  }
  if (action === "cycle") {
    const next = cycleMode(current, modes);
    config.agent = { ...config.agent, name: next };
    const { saveConfig } = await import("@pi/config");
    saveConfig(config, path);
    const m = getNextMode(current, modes);
    console.log(`  cycled: ${current} → ${m.name} (${m.label})`);
    return;
  }
  if (action === "set") {
    if (!name) {
      console.error("usage: pi mode set <name>");
      process.exit(1);
    }
    const m = modes.find((x) => x.name === name);
    if (!m) {
      console.error(`unknown mode: ${name} (available: ${modes.map((x) => x.name).join(", ")})`);
      process.exit(1);
    }
    config.agent = { ...config.agent, name: m.name };
    const { saveConfig } = await import("@pi/config");
    saveConfig(config, path);
    console.log(`  set mode: ${m.name} (${m.label})`);
    return;
  }
  console.error(`unknown action: ${action}`);
  console.error("actions: show, list, cycle, set <name>");
  process.exit(1);
}
