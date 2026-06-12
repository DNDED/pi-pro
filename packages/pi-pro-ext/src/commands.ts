/**
 * pi-pro command manifest — single source of truth for the 12 commands.
 *
 * Each entry has the OpenCode-style fields the palette and :help render from.
 * To add a new command: append an entry below and the register loop in index.ts
 * picks it up automatically.
 */
export type Category = "Mode" | "Memory" | "Config" | "Auth" | "System" | "Help";

export interface PaletteCommand {
  /** internal id, e.g. "plan" */
  name: string;
  /** display title in palette + help, e.g. "Toggle Plan Mode" */
  title: string;
  /** one-line description */
  description: string;
  /** category bucket — drives grouping in :help and the palette order */
  category: Category;
  /** slash name, e.g. "plan" → registered as /plan and :plan */
  slashName: string;
  /** keybind shown in the footer, e.g. "Tab", "Ctrl+P" — undefined if none */
  keybind?: string;
  /** pinned to the top of the palette (OpenCode's "suggested" section) */
  suggested?: boolean;
  /** actually run the command */
  run: (ctx: CommandCtx) => void | Promise<void>;
}

export interface CommandCtx {
  ui: {
    select: (title: string, options: string[], opts?: any) => Promise<string | undefined>;
    confirm: (title: string, message: string, opts?: any) => Promise<boolean>;
    input: (title: string, placeholder?: string, opts?: any) => Promise<string | undefined>;
    notify: (message: string, type?: "info" | "warning" | "error") => void;
    setStatus: (key: string, text: string | undefined) => void;
    setWidget: (key: string, content: string[] | undefined) => void;
  };
  args: string | undefined;
  pi: {
    sendUserMessage: (content: string) => void;
    getModel?: () => unknown;
    getThinkingLevel?: () => string;
  };
  ctx: unknown;
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig, getDefaultModes, cycleMode as cycleModeCfg } from "@pi-pro/config";
import { execSync } from "node:child_process";
import { buildStatusLine, VERSION } from "./pi-pro-meta.js";
import { applyOrng, resetTheme, currentThemeName, type ThemeChoice } from "./theme-write.js";
import { setModeAndPersist } from "./mode.js";
import { openPalette } from "./palette.js";
import { refreshHeader } from "./header.js";
import { listMemoryState, addMemoryEntry, clearMemoryEntries } from "./memory.js";
import { writeAuthJson, readAuthJson } from "./auth.js";

function getCurrentModeName(): string {
  try { return loadConfig().agent.name; } catch { return "build"; }
}

function maskKey(k: string): string {
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}...${k.slice(-4)}`;
}

function readGit(cwd: string): { branch: string | null; porcelain: string } {
  try { execSync("test -d .git", { cwd, stdio: "ignore" }); } catch { return { branch: null, porcelain: "" }; }
  let branch: string | null = null;
  let porcelain = "";
  try { branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", { cwd, encoding: "utf8" }).trim() || null; } catch { branch = null; }
  try { porcelain = execSync("git status --porcelain 2>/dev/null", { cwd, encoding: "utf8" }); } catch { porcelain = ""; }
  return { branch, porcelain };
}

export const COMMANDS: PaletteCommand[] = [
  {
    name: "mode",
    title: "Cycle Agent Mode",
    description: "Switch between build and plan modes. Tab in editor to cycle.",
    category: "Mode",
    slashName: "mode",
    keybind: "Tab",
    suggested: true,
    run: ({ ui, args }) => {
      const arg = args?.trim();
      const modes = getDefaultModes();
      if (!arg) {
        const cfg = loadConfig();
        for (const m of modes) {
          const marker = m.name === cfg.agent.name ? ">" : " ";
          ui.notify(`${marker} ${m.name}  ${m.label}${m.readOnly ? " (read-only)" : ""}`, "info");
        }
        return;
      }
      const target = modes.find((m) => m.name === arg);
      if (!target) { ui.notify(`unknown mode: ${arg} (available: build, plan)`, "error"); return; }
      setModeAndPersist(target.name, ui as any);
      ui.notify(`mode: ${target.name} (${target.label})${target.readOnly ? " — read-only" : ""}`, "info");
    },
  },
  {
    name: "plan",
    title: "Toggle Plan Mode",
    description: "Switch to read-only mode. Bash + write/edit blocked.",
    category: "Mode",
    slashName: "plan",
    keybind: "Tab",
    suggested: true,
    run: ({ ui }) => {
      const current = getCurrentModeName();
      const target = current === "plan" ? "build" : "plan";
      setModeAndPersist(target, ui as any);
      ui.notify(`plan mode: ${target === "plan" ? "ON (read-only)" : "OFF (build)"}`, "info");
    },
  },
  {
    name: "todos",
    title: "Show Todo List",
    description: "Show the current todo list (managed by the todo tool).",
    category: "System",
    slashName: "todos",
    run: ({ ui }) => {
      ui.notify("(no todos)", "info");
    },
  },
  {
    name: "config",
    title: "Show Config",
    description: "Show pi-pro config (provider, model, agent, theme, modes).",
    category: "Config",
    slashName: "config",
    run: ({ ui }) => {
      try {
        const cfg = loadConfig();
        const lines = [
          `pi-pro config · v${VERSION}`,
          `-`.repeat(40),
          `  provider:  ${cfg.provider.name}`,
          `  model:     ${cfg.provider.model}`,
          cfg.provider.baseUrl ? `  baseUrl:   ${cfg.provider.baseUrl}` : "",
          `  agent:     ${cfg.agent.name}`,
          `  max iter:  ${cfg.agent.maxIterations}`,
          `  tool budget: ${cfg.agent.toolBudget}`,
          `  modes:     ${getDefaultModes().map((m) => m.name).join(", ")}`,
        ].filter(Boolean);
        ui.notify(lines.join("\n"), "info");
      } catch (e) {
        ui.notify(`error loading config: ${(e as Error).message}`, "error");
      }
    },
  },
  {
    name: "doctor",
    title: "Run Doctor",
    description: "System + auth + tool check.",
    category: "Config",
    slashName: "doctor",
    suggested: true,
    run: ({ ui }) => {
      const lines = [`pi-pro doctor v${VERSION}`, `-`.repeat(40)];
      try {
        const cfg = loadConfig();
        const auth = readAuthJson();
        const envKey = process.env.OPENCODE_API_KEY;
        const keySource = envKey ? { ok: true, source: "env" as const, key: envKey } : auth[cfg.provider.name]?.key ? { ok: true, source: "auth.json" as const, key: auth[cfg.provider.name]!.key } : { ok: false, source: "none" as const };
        lines.push(`  provider:  ${cfg.provider.name}`);
        lines.push(`  model:     ${cfg.provider.model}`);
        lines.push(`  api key:   ${keySource.ok ? `v ${maskKey(keySource.key!)} (${keySource.source})` : "X (no key)"}`);
        lines.push(`  mode:      ${cfg.agent.name}${cfg.agent.name === "plan" ? " (read-only)" : ""}`);
        lines.push(`  cwd:       ${process.cwd()}`);
        const git = readGit(process.cwd());
        if (git.branch) lines.push(`  git:       ${git.branch}${git.porcelain ? " (dirty)" : ""}`);
        lines.push(`  theme:     pi-pro manages zentui.json (OpenCode orange)`);
      } catch (e) {
        lines.push(`  error: ${(e as Error).message}`);
      }
      ui.notify(lines.join("\n"), "info");
    },
  },
  {
    name: "theme",
    title: "Switch Theme",
    description: "Apply OpenCode orange or reset to zentui defaults. Usage: :theme opencode|default",
    category: "Config",
    slashName: "theme",
    run: ({ ui, args }) => {
      const arg = (args ?? "").trim().toLowerCase();
      const theme: ThemeChoice = arg === "default" ? "default" : "orng";
      if (theme === "orng") {
        applyOrng(theme);
        ui.notify(`v theme: orng (OpenCode orange applied to zentui.json)`, "info");
      } else {
        resetTheme();
        ui.notify(`v theme: default (zentui.json reset)`, "info");
      }
      refreshHeader(ui as any);
    },
  },
  {
    name: "apikey",
    title: "Set API Key",
    description: "Set API key for a provider. Writes ~/.pi/agent/auth.json (0600). Usage: :apikey <provider> [key]",
    category: "Auth",
    slashName: "apikey",
    run: ({ ui, args }) => {
      const parts = (args ?? "").trim().split(/\s+/);
      const provider = parts[0];
      let key = parts.slice(1).join(" ");
      if (!provider) {
        ui.notify("usage: :apikey <provider> [key]  (e.g. :apikey opencode-go sk-...)", "error");
        return;
      }
      if (!key) {
        ui.notify(`(no key arg) paste it now in the dialog`, "info");
        ui.input(`Enter API key for ${provider}:`, "").then((got) => {
          if (!got) { ui.notify("login cancelled (no key)", "info"); return; }
          try {
            const auth = readAuthJson();
            auth[provider] = { type: "api_key", key: got.trim() };
            writeAuthJson(auth);
            ui.notify(`v saved ${provider} key to auth.json (masked: ${maskKey(got.trim())})`, "info");
          } catch (e) {
            ui.notify(`login failed: ${(e as Error).message}`, "error");
          }
        });
        return;
      }
      try {
        const auth = readAuthJson();
        auth[provider] = { type: "api_key", key };
        writeAuthJson(auth);
        ui.notify(`v saved ${provider} key to auth.json (masked: ${maskKey(key)})`, "info");
      } catch (e) {
        ui.notify(`login failed: ${(e as Error).message}`, "error");
      }
    },
  },
  {
    name: "memory-add",
    title: "Memory: Add",
    description: "Add a chunk to cross-session memory (JSONL).",
    category: "Memory",
    slashName: "memory-add",
    run: ({ ui, args }) => {
      const text = args?.trim();
      if (!text) { ui.notify("usage: :memory-add <text>", "error"); return; }
      const r = addMemoryEntry(text, "narrative");
      ui.notify(`v added #${r.entry.ts} (${r.state.entries.length} total)`, "info");
    },
  },
  {
    name: "memory-list",
    title: "Memory: List",
    description: "List memory entries (newest first).",
    category: "Memory",
    slashName: "memory-list",
    run: ({ ui }) => {
      const entries = listMemoryState();
      if (entries.length === 0) { ui.notify("(no memory entries)", "info"); return; }
      const lines = entries.slice(0, 20).map((e) => `  #${e.ts} [${e.role}] ${e.text.slice(0, 80)}`);
      if (entries.length > 20) lines.push(`  ... and ${entries.length - 20} more`);
      ui.notify(lines.join("\n"), "info");
    },
  },
  {
    name: "memory-search",
    title: "Memory: Search",
    description: "Search memory entries. Usage: :memory-search <query>",
    category: "Memory",
    slashName: "memory-search",
    run: ({ ui, args }) => {
      const q = args?.trim();
      if (!q) { ui.notify("usage: :memory-search <query>", "error"); return; }
      const lower = q.toLowerCase();
      const matches = listMemoryState()
        .map((e) => ({ e, s: e.text.toLowerCase().includes(lower) ? 10 : 0 }))
        .filter((m) => m.s > 0)
        .slice(0, 5);
      if (matches.length === 0) { ui.notify(`no matches for: ${q}`, "info"); return; }
      ui.notify(matches.map((m) => `  #${m.e.ts} [${m.e.role}] ${m.e.text.slice(0, 100)}`).join("\n"), "info");
    },
  },
  {
    name: "memory-clear",
    title: "Memory: Clear All",
    description: "Clear all memory entries (file + in-memory).",
    category: "Memory",
    slashName: "memory-clear",
    run: ({ ui }) => {
      const n = clearMemoryEntries();
      ui.notify(`v cleared ${n} entries`, "info");
    },
  },
  {
    name: "btw",
    title: "Side Question (BTW)",
    description: "Queue a side question to the agent. Usage: :btw <question>",
    category: "System",
    slashName: "btw",
    run: ({ pi, ui, args }) => {
      const q = args?.trim();
      if (!q) { ui.notify("usage: :btw <question>", "error"); return; }
      pi.sendUserMessage(`[side question, no edit] ${q}`);
      ui.notify(`queued btw: ${q.slice(0, 80)}`, "info");
    },
  },
  {
    name: "context",
    title: "Context Budget",
    description: "Show context window usage (tokens + percent).",
    category: "System",
    slashName: "context",
    run: ({ ui, ctx }) => {
      const usage = (ctx as { getContextUsage?: () => any }).getContextUsage?.();
      if (!usage) { ui.notify("(context usage not available)", "info"); return; }
      if (usage.tokens == null || usage.contextWindow == null || usage.percent == null) {
        ui.notify("ctx: (compacting or no model context window)", "info");
        return;
      }
      const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
      const color = usage.percent < 0.75 ? "ok" : usage.percent < 0.9 ? "warn" : "high";
      ui.notify(`ctx: ${fmt(usage.tokens)}/${fmt(usage.contextWindow)} (${Math.round(usage.percent * 100)}%) ${color}`, "info");
    },
  },
  {
    name: "palette",
    title: "Open Command Palette",
    description: "Fuzzy search all commands. Ctrl+P also opens this.",
    category: "System",
    slashName: "palette",
    keybind: "Ctrl+P",
    suggested: true,
    run: ({ ctx, pi, ui }) => openPalette(ctx, pi, COMMANDS, { ui }),
  },
  {
    name: "help",
    title: "Show Help",
    description: "List all commands grouped by category.",
    category: "Help",
    slashName: "help",
    suggested: true,
    run: ({ ui }) => ui.notify(formatHelp(COMMANDS), "info"),
  },
];

/**
 * Format commands into the :help output, grouped by category, with keybinds.
 * Falls back to the same renderer that the palette uses.
 */
export function formatHelp(commands: PaletteCommand[]): string {
  const versionLine = `pi-pro v${VERSION} · ${COMMANDS.length} commands`;
  const byCat: Record<string, PaletteCommand[]> = {};
  for (const c of commands) {
    (byCat[c.category] ??= []).push(c);
  }
  const catOrder: Category[] = ["Mode", "Memory", "Config", "Auth", "System", "Help"];
  const lines: string[] = [versionLine, "─".repeat(50)];
  for (const cat of catOrder) {
    const items = byCat[cat];
    if (!items || items.length === 0) continue;
    lines.push("");
    lines.push(`  ${cat.toUpperCase()}`);
    for (const c of items) {
      const keyb = c.keybind ? `[${c.keybind}] ` : "         ";
      const desc = c.description.length > 60 ? c.description.slice(0, 57) + "..." : c.description;
      lines.push(`    ${keyb}/${c.slashName}${c.slashName.length < 10 ? " ".repeat(10 - c.slashName.length) : ""}  ${desc}`);
    }
  }
  lines.push("");
  lines.push("  Press `/` for all pi-mono commands + pi-pro.  Ctrl+P for the palette.");
  return lines.join("\n");
}
