import { loadConfig, saveConfig, getConfigPath } from "@pi/config";

export async function ui(action?: string, value?: string, opts: { configPath?: string } = {}): Promise<void> {
  const path = opts.configPath ?? getConfigPath();
  const config = loadConfig(path);
  const ui = config.ui ?? { editor: true, statusLine: true, copyFriendly: false, nerdFonts: true, icons: {}, colors: {}, gitStatusIntervalMs: 5000 };

  if (!action || action === "show") {
    console.log("ui config");
    console.log("─".repeat(40));
    console.log(`  editor:        ${ui.editor}`);
    console.log(`  statusline:    ${ui.statusLine}`);
    console.log(`  copy-friendly: ${ui.copyFriendly}`);
    console.log(`  nerdFonts:     ${ui.nerdFonts}`);
    console.log(`  git interval:  ${ui.gitStatusIntervalMs}ms`);
    return;
  }
  if (action === "copy-friendly" || action === "copy_friendly") {
    const next = value === "toggle" ? !ui.copyFriendly : value === "true" || value === "1" || value === "on";
    config.ui = { ...ui, copyFriendly: next };
    saveConfig(config, path);
    console.log(`  copy-friendly: ${next}`);
    return;
  }
  if (action === "statusline" || action === "status-line") {
    const next = value === "toggle" ? !ui.statusLine : value === "true" || value === "1" || value === "on";
    config.ui = { ...ui, statusLine: next };
    saveConfig(config, path);
    console.log(`  statusline: ${next}`);
    return;
  }
  if (action === "nerdfonts" || action === "nerd-fonts") {
    const next = value === "toggle" ? !ui.nerdFonts : value === "true" || value === "1" || value === "on";
    config.ui = { ...ui, nerdFonts: next };
    saveConfig(config, path);
    console.log(`  nerdFonts: ${next}`);
    return;
  }
  console.error(`unknown action: ${action}`);
  console.error("actions: show, copy-friendly, statusline, nerdfonts");
  process.exit(1);
}
