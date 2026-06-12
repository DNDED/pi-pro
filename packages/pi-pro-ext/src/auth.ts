/**
 * auth.json read/write with mode 0600.
 * Mirrors the pattern used by pi-mono's AuthStorage but in pure stdlib.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ApiKeyCred { type: "api_key"; key: string; }

function agentDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "pi-pro");
  return join(process.env.PI_HOME_OVERRIDE ?? homedir(), ".pi", "agent");
}

export function authPath(): string {
  return join(agentDir(), "auth.json");
}

export function readAuthJson(): Record<string, ApiKeyCred> {
  const p = authPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}

export function writeAuthJson(data: Record<string, ApiKeyCred>): void {
  const dir = agentDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const p = authPath();
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  chmodSync(tmp, 0o600);
  // Atomic rename
  const { renameSync } = require("node:fs") as typeof import("node:fs");
  renameSync(tmp, p);
  chmodSync(p, 0o600);
}
