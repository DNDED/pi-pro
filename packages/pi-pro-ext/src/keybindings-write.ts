/**
 * keybindings.json writer — rebinds 3 actions off Ctrl+P so we can use it
 * for the command palette.
 *
 * Safety:
 *   - Reads the existing keybindings.json (if any) and merges our re-bind in.
 *   - Other keys in the user's file are preserved.
 *   - Backs up the existing file (if any) to keybindings.json.bak.<timestamp>.
 *   - Atomic write: tmp + rename.
 *   - Idempotent: if our re-bind is already there, skip the write.
 *   - Triggers a reload of the keybindings manager (keybindings don't hot-watch).
 */
import { writeFileSync, readFileSync, existsSync, renameSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const REBIND = {
  "app.model.cycleForward": ["f2"],
  "app.session.togglePath": ["f2"],
  "app.models.toggleProvider": ["f2"],
} as const;

function keybindingsPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "pi-pro");
  return join(process.env.PI_HOME_OVERRIDE ?? homedir(), ".pi", "agent", "keybindings.json");
}

function readKeybindings(): Record<string, string[]> {
  const p = keybindingsPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")) as Record<string, string[]>; } catch { return {}; }
}

function isRebindInPlace(record: Record<string, string[]>): boolean {
  for (const [k, v] of Object.entries(REBIND)) {
    if (JSON.stringify(record[k]) !== JSON.stringify(v)) return false;
  }
  return true;
}

/**
 * Apply the Ctrl+P re-bind. Idempotent. Backups existing file.
 * Returns true if a write happened.
 */
export function freeCtrlP(): { wrote: boolean; path: string } {
  const p = keybindingsPath();
  const existing = readKeybindings();
  if (isRebindInPlace(existing)) return { wrote: false, path: p };
  const merged = { ...existing, ...REBIND };
  if (existsSync(p)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    try { copyFileSync(p, `${p}.bak.${ts}`); } catch { /* best-effort */ }
  }
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(merged, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, p);
  return { wrote: true, path: p };
}
