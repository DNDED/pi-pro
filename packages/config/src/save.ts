import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { validateConfig, type PiConfig } from "./types.js";
import { getConfigPath } from "./paths.js";

export function saveConfig(config: PiConfig, path?: string): void {
  const p = path ?? getConfigPath();
  const result = validateConfig(config);
  if (!result.ok) throw new Error(`Invalid config: ${result.errors.join("; ")}`);
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  renameSync(tmp, p);
}
