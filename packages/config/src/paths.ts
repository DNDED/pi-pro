import { join } from "node:path";
import { homedir } from "node:os";

function resolveHome(): string {
  return process.env.PI_HOME_OVERRIDE ?? homedir();
}

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "pi-pro");
  return join(resolveHome(), ".pi");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "pi.json");
}

export function getAuthPath(): string {
  return join(getConfigDir(), "pi-auth.json");
}
