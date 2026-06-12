import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PiConfig } from "./types.js";
import { validateConfig } from "./types.js";

export function saveConfig(config: PiConfig, path: string): void {
  const result = validateConfig(config);
  if (!result.ok) {
    throw new Error(`Invalid config: ${result.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  renameSync(tmp, path);
}
