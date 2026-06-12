import type { AgentMode } from "./types.js";
import { getDefaultModes } from "./defaults.js";

export function listModes(modes: AgentMode[]): AgentMode[] {
  return modes.length > 0 ? modes : getDefaultModes();
}

export function getMode(name: string, modes: AgentMode[]): AgentMode | undefined {
  return listModes(modes).find((m) => m.name === name);
}

export function cycleMode(currentName: string, modes: AgentMode[]): string {
  const all = listModes(modes);
  const idx = all.findIndex((m) => m.name === currentName);
  if (idx === -1) return all[0]!.name;
  const next = all[(idx + 1) % all.length]!;
  return next.name;
}

export function getNextMode(currentName: string, modes: AgentMode[]): AgentMode {
  const next = cycleMode(currentName, modes);
  const m = getMode(next, modes)!;
  return m;
}
