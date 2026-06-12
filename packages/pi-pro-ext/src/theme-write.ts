/**
 * Theme writer — applies OpenCode orange to pi-zentui.json (idempotent).
 *
 * Driven by `piPro.theme` in our own `~/.pi/agent/pi.json`:
 *   - "orng"    → apply orange to zentui.json on every session_start
 *   - "default" → don't touch zentui.json
 *
 * Idempotency rules:
 *   - Only touches the keys we own: `colors.editorAccent/Border/Prompt/Model`
 *     and `colorSources.editor`.
 *   - Preserves all other zentui.json keys (icons, features, extensionStatuses, etc.)
 *   - Atomic write: tmp + rename.
 *   - Never writes unless piPro.theme === "orng" (no surprise clobbers).
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type ThemeChoice = "orng" | "default";

interface ZentuiRecord {
  colors?: Record<string, string>;
  colorSources?: Record<string, string>;
  icons?: Record<string, string>;
  features?: Record<string, boolean>;
  extensionStatuses?: Record<string, unknown>;
  [k: string]: unknown;
}

const ORNG = {
  editorAccent: "#EC5B2B",
  editorBorder: "#EC5B2B",
  editorPrompt: "#EE7948",
  editorModel: "#EE7948",
} as const;

function zentuiPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "pi-pro");
  return join(process.env.PI_HOME_OVERRIDE ?? homedir(), ".pi", "agent", "zentui.json");
}

function readZentui(): ZentuiRecord {
  const p = zentuiPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")) as ZentuiRecord; } catch { return {}; }
}

function writeZentui(record: ZentuiRecord): void {
  const p = zentuiPath();
  mkdirSync(join(p, ".."), { recursive: true, mode: 0o700 });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(record, null, 2), { encoding: "utf8", mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, p);
  chmodSync(p, 0o600);
}

/**
 * Read what the user's piPro.theme is set to. Returns "orng" if not set
 * (first-run default per Sid's preference).
 */
export function currentThemeName(): ThemeChoice {
  try {
    const cfg = JSON.parse(readFileSync(join(piJsonPath(), "pi.json"), "utf8")) as { piPro?: { theme?: string } };
    if (cfg.piPro?.theme === "default") return "default";
    return "orng";
  } catch {
    return "orng";
  }
}

function piJsonPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "pi-pro");
  return join(process.env.PI_HOME_OVERRIDE ?? homedir(), ".pi", "agent");
}

export function applyOrng(theme: ThemeChoice): void {
  if (theme !== "orng") return;
  const record = readZentui();
  record.colors = { ...(record.colors ?? {}), ...ORNG };
  record.colorSources = { ...(record.colorSources ?? {}), editor: "theme" };
  writeZentui(record);
}

export function resetTheme(): void {
  const record = readZentui();
  if (record.colors) {
    for (const k of Object.keys(ORNG)) delete record.colors[k];
  }
  if (record.colorSources) {
    delete record.colorSources.editor;
  }
  writeZentui(record);
}
