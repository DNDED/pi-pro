/**
 * Mode persistence + active-tool application.
 * Owns the disk↔memory sync of the build/plan mode bit.
 */
import { loadConfig, saveConfig, getDefaultModes } from "@pi-pro/config";
import { clearPlan } from "./plan-runtime.js";

export function getCurrentModeName(): string {
  try { return loadConfig().agent.name; } catch { return "build"; }
}

export function setModeName(name: string): void {
  const cfg = loadConfig();
  cfg.agent.name = name;
  saveConfig(cfg);
}

const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"];

export function applyActiveTools(pi: { setActiveTools: (names: string[]) => void; getAllTools: () => Array<{ name: string }> }, modeName: string, snapshot: string[]): void {
  if (modeName === "plan") {
    pi.setActiveTools(PLAN_MODE_TOOLS as never);
  } else if (snapshot.length > 0) {
    pi.setActiveTools(snapshot as never);
  }
}

/**
 * Apply a mode change end-to-end: persist to disk, apply active tools,
 * update the pi-pro status line, clear the plan widget if leaving plan mode.
 */
export function setModeAndPersist(
  name: string,
  ui: { setStatus: (k: string, t: string | undefined) => void; setWidget: (k: string, c: string[] | undefined) => void; notify: (m: string, t?: "info" | "warning" | "error") => void },
  pi?: { setActiveTools: (names: string[]) => void; getAllTools: () => Array<{ name: string }> },
  allToolSnapshot?: string[],
): void {
  setModeName(name);
  if (pi && allToolSnapshot) applyActiveTools(pi, name, allToolSnapshot);
  if (name !== "plan") clearPlan(ui);
}

export { getDefaultModes };
