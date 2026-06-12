import type { AgentMode, PiConfig } from "./types.js";

export const DEFAULT_CONFIG: PiConfig = {
  version: 1,
  provider: {
    name: "opencode-go",
    model: "minimax-m3",
  },
  agent: {
    name: "build",
    maxIterations: 10,
    toolBudget: 6,
  },
  theme: {
    name: "default",
  },
  ui: {
    editor: true,
    statusLine: true,
    copyFriendly: false,
    nerdFonts: true,
    icons: {},
    colors: {},
    gitStatusIntervalMs: 5000,
  },
};

export function getDefaultModes(): AgentMode[] {
  return [
    {
      name: "build",
      label: "BUILD",
      color: "success",
      activeTools: ["read", "write", "edit", "bash", "grep", "glob", "find", "ls", "webfetch"],
      readOnly: false,
    },
    {
      name: "plan",
      label: "PLAN",
      color: "warning",
      activeTools: ["read", "bash", "grep", "find", "ls", "questionnaire"],
      readOnly: true,
    },
  ];
}
