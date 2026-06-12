/**
 * pi-pro v0.2.1 — extension for pi-mono.
 *
 * Loaded automatically by `pi` when registered in ~/.pi/agent/settings.json.
 * Provides:
 *   - Agent mode cycle (build/plan) + Tab shortcut
 *   - Plan mode: DESTRUCTIVE_PATTERNS bash gate + read-only tool allowlist
 *   - Todo tool (LLM-callable, state in tool result details)
 *   - Memory: file-based JSONL store (add/search/list/clear)
 *   - Starship-style footer (cwd + branch + git icons + runtime) — themed
 *   - Plan widget ([DONE:n] markers, setWidget aboveEditor) — themed
 *   - Theme system: default, vivid, monokai, noir
 *   - REPL helpers: :mode, :plan, :todos, :config, :doctor, :theme,
 *     /btw, /context, /memory-*
 *
 * Install: `pi install ./packages/pi-pro-ext`
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { loadConfig, saveConfig, getDefaultModes, cycleMode as cycleModeCfg } from "@pi-pro/config";
import { execSync } from "node:child_process";
import { buildColoredFooter } from "./src/footer.js";
import { parsePlanItems, markPlanDone, renderPlanWidget, isSafeBash } from "./src/plan-widget.js";
import { summarizeGitStatus } from "./src/util/git-status.js";
import { detectRuntime, formatRuntime } from "./src/util/runtime-detect.js";
import { detectNerdFonts } from "./src/util/nerd-fonts.js";
import {
  getTheme,
  listThemes,
  readColorEnv,
  shouldUseColor,
  paint,
  paintMany,
} from "./src/theme.js";
import {
  addMemory,
  clearMemory,
  listMemory,
  loadMemoryState,
  searchMemory,
  type MemoryState,
} from "./src/memory.js";

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

const TODO_INIT: { items: TodoItem[]; nextId: number } = { items: [], nextId: 1 };

function todoAdd(state: typeof TODO_INIT, text: string): { state: typeof TODO_INIT; item?: TodoItem; error?: string } {
  if (!text.trim()) return { state, error: "text required for add" };
  const item: TodoItem = { id: state.nextId, text: text.trim(), done: false };
  return { state: { items: [...state.items, item], nextId: state.nextId + 1 }, item };
}

function todoToggle(state: typeof TODO_INIT, id: number): { state: typeof TODO_INIT; error?: string } {
  const item = state.items.find((t) => t.id === id);
  if (!item) return { state, error: `todo #${id} not found` };
  return { state: { items: state.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)), nextId: state.nextId } };
}

function todoClear(): typeof TODO_INIT {
  return { items: [], nextId: 1 };
}

function renderTodos(state: typeof TODO_INIT): string {
  if (state.items.length === 0) return "  (no todos)";
  const done = state.items.filter((t) => t.done).length;
  const lines = [`  ${done}/${state.items.length} completed`];
  for (const t of state.items) {
    lines.push(`  ${t.done ? "✓" : "○"} #${t.id} ${t.text}`);
  }
  return lines.join("\n");
}

function maskKey(k: string): string {
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}...${k.slice(-4)}`;
}

function getEnvKey(provider: string): string | undefined {
  const map: Record<string, string> = {
    "opencode-go": "OPENCODE_API_KEY",
    "opencode": "OPENCODE_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "google": "GEMINI_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "groq": "GROQ_API_KEY",
    "minimax": "MINIMAX_API_KEY",
  };
  return process.env[map[provider] ?? `${provider.toUpperCase()}_API_KEY`];
}

interface GitInfo {
  branch: string | null;
  ahead: number;
  behind: number;
  porcelain: string;
}

function readGit(cwd: string): GitInfo {
  try {
    execSync("test -d .git", { cwd, stdio: "ignore" });
  } catch {
    return { branch: null, ahead: 0, behind: 0, porcelain: "" };
  }
  let branch: string | null = null;
  let ahead = 0;
  let behind = 0;
  let porcelain = "";
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", { cwd, encoding: "utf8" }).trim() || null;
  } catch { branch = null; }
  try {
    porcelain = execSync("git status --porcelain 2>/dev/null", { cwd, encoding: "utf8" });
  } catch { porcelain = ""; }
  try {
    const counts = execSync(
      'git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0\t0"',
      { cwd, encoding: "utf8" },
    ).trim().split(/\s+/);
    ahead = parseInt(counts[0] ?? "0", 10) || 0;
    behind = parseInt(counts[1] ?? "0", 10) || 0;
  } catch { ahead = 0; behind = 0; }
  return { branch, ahead, behind, porcelain };
}

export default function (pi: ExtensionAPI): void {
  const todoState: { items: TodoItem[]; nextId: number } = { items: [], nextId: 1 };
  const memState: MemoryState = loadMemoryState();
  let planItems: { step: number; text: string; completed: boolean }[] = [];

  function getCurrentModeName(): string {
    try {
      return loadConfig().agent.name;
    } catch {
      return "build";
    }
  }

  function setModeName(name: string): void {
    try {
      const cfg = loadConfig();
      cfg.agent.name = name;
      saveConfig(cfg);
    } catch {
      // best-effort
    }
  }

  function applyActiveTools(modeName: string): void {
    const modes = getDefaultModes();
    const m = modes.find((x) => x.name === modeName);
    if (!m) return;
    if (m.activeTools.length > 0) {
      pi.setActiveTools(m.activeTools as never);
    }
  }

  function rebuildFooter(_ctx: unknown): string {
    const cwd = process.cwd();
    const git = readGit(cwd);
    const runtime = detectRuntime(cwd);
    const nerdFonts = detectNerdFonts();
    const summary = summarizeGitStatus(git.porcelain, git.branch, git.ahead, git.behind, nerdFonts);
    const modeName = getCurrentModeName();
    const isPlan = modeName === "plan";
    let cfg;
    try { cfg = loadConfig(); } catch { cfg = null; }
    const theme = getTheme(cfg?.theme?.name);
    const useColor = shouldUseColor(readColorEnv(process.env, cfg));
    const segs = buildColoredFooter({
      cwd,
      branch: git.branch,
      gitIcons: summary.icons,
      runtime: runtime ? formatRuntime(runtime).replace(/^via\s+/, "") : null,
      mode: modeName,
      modeReadOnly: isPlan,
      nerdFonts,
      version: "0.2.2",
      gitState: summary.state,
    });
    return paintMany(
      segs.map((s) => ({ text: s.text, color: s.color })),
      theme,
      useColor,
    );
  }

  function useColorFor(_ctx: unknown): boolean {
    try {
      const cfg = loadConfig();
      const env = readColorEnv(process.env, cfg);
      return shouldUseColor(env);
    } catch {
      return false;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    const modeName = getCurrentModeName();
    applyActiveTools(modeName);

    const cwd = process.cwd();
    const git = readGit(cwd);
    const runtime = detectRuntime(cwd);
    const nerdFonts = detectNerdFonts();
    const summary = summarizeGitStatus(git.porcelain, git.branch, git.ahead, git.behind, nerdFonts);
    const isPlan = modeName === "plan";

    let cfg;
    try { cfg = loadConfig(); } catch { cfg = null; }
    const theme = getTheme(cfg?.theme?.name);
    const env = readColorEnv(process.env, cfg);
    const useColor = shouldUseColor(env);

    const segs = buildColoredFooter({
      cwd,
      branch: git.branch,
      gitIcons: summary.icons,
      runtime: runtime ? formatRuntime(runtime).replace(/^via\s+/, "") : null,
      mode: modeName,
      modeReadOnly: isPlan,
      nerdFonts,
      version: "0.2.1",
      gitState: summary.state,
    });
    const footer = paintMany(
      segs.map((s) => ({ text: s.text, color: s.color })),
      theme,
      useColor,
    );
    try {
      (ctx.ui as { setStatus?: (k: string, t: string | undefined) => void }).setStatus?.("pi-pro-footer", footer);
    } catch {
      // ignore
    }
    if (ctx.hasUI) {
      const note = `pi-pro v0.2.1 · ${modeName}${isPlan ? " (read-only)" : ""} · ${theme.name}`;
      ctx.ui.notify(useColor ? paint(note, "accent", theme, true) : note, "info");
    }
  });

  pi.on("tool_call", async (event) => {
    const modeName = getCurrentModeName();
    if (modeName !== "plan") return;
    if (event.toolName === "bash") {
      const input = event.input as { command?: string };
      const cmd = input.command ?? "";
      if (isSafeBash(cmd)) return;
      return { block: true, reason: `Plan mode: bash blocked (destructive pattern). Command: ${cmd.slice(0, 200)}` };
    }
    if (event.toolName === "write" || event.toolName === "edit") {
      return { block: true, reason: "Plan mode is read-only (no edits/writes). Use :mode build to switch." };
    }
  });

  pi.on("before_agent_start", async () => {
    const modeName = getCurrentModeName();
    if (modeName !== "plan") return;
    return {
      message: {
        customType: "pi-pro-plan-mode",
        content:
          `[PLAN MODE ACTIVE]\n` +
          `You are in plan mode — a read-only exploration mode.\n\n` +
          `Restrictions:\n- Tools: read, bash (filtered), grep, find, ls\n` +
          `- Bash: blocked by DESTRUCTIVE_PATTERNS (rm -rf, sudo, chmod 777, git push, etc.)\n` +
          `- NO edits, writes, or file modifications\n\n` +
          `Describe plans under a "Plan:" header with numbered steps:\n` +
          `Plan:\n1. First step\n2. Second step\n\n` +
          `When execution starts, mark steps done with [DONE:n] markers.`,
        display: false,
      },
    };
  });

  pi.on("agent_end", async (event, ctx) => {
    if (getCurrentModeName() !== "plan") return;
    const last = [...(event.messages as { role: string; content: unknown }[])].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const text = typeof last.content === "string" ? last.content : JSON.stringify(last.content);
    if (planItems.length === 0) {
      planItems = parsePlanItems(text);
    }
    if (planItems.length > 0) {
      markPlanDone(text, planItems);
      const lines = renderPlanWidget(planItems);
      if (lines.length > 0) {
        try {
          (ctx.ui as { setWidget?: (k: string, c: string[] | undefined) => void }).setWidget?.("pi-pro-plan", lines);
        } catch {
          // ignore
        }
      }
    }
  });

  pi.on("turn_end", async (event, ctx) => {
    if (getCurrentModeName() !== "plan") return;
    if (planItems.length === 0) return;
    const lastMsg = (event.message ?? null) as { content?: unknown } | null;
    if (!lastMsg) return;
    const text = typeof lastMsg.content === "string"
      ? lastMsg.content
      : JSON.stringify(lastMsg.content ?? "");
    markPlanDone(text, planItems);
    const lines = renderPlanWidget(planItems);
    try {
      (ctx.ui as { setWidget?: (k: string, c: string[] | undefined) => void }).setWidget?.("pi-pro-plan", lines);
    } catch {
      // ignore
    }
  });

  pi.on("session_shutdown", async () => {
    planItems = [];
  });

  pi.registerCommand("mode", {
    description: "Show/cycle/set agent mode (build | plan). Tab in editor to cycle.",
    handler: async (args, ctx) => {
      const arg = args?.trim();
      if (!arg) {
        const cfg = loadConfig();
        for (const m of getDefaultModes()) {
          const marker = m.name === cfg.agent.name ? "→" : " ";
          ctx.ui.notify(`${marker} ${m.name}  ${m.label}${m.readOnly ? " (read-only)" : ""}`, "info");
        }
        return;
      }
      const target = getDefaultModes().find((m) => m.name === arg);
      if (!target) {
        ctx.ui.notify(`unknown mode: ${arg} (available: build, plan)`, "error");
        return;
      }
      setModeName(target.name);
      applyActiveTools(target.name);
      ctx.ui.notify(`mode: ${target.name} (${target.label})${target.readOnly ? " — read-only" : ""}`, "info");
    },
  });

  pi.registerCommand("plan", {
    description: "Toggle plan mode (read-only). Cycles build ↔ plan.",
    handler: async (_args, ctx) => {
      const current = getCurrentModeName();
      const target = current === "plan" ? "build" : "plan";
      setModeName(target);
      applyActiveTools(target);
      ctx.ui.notify(`plan mode: ${target === "plan" ? "ON (read-only)" : "OFF (build)"}`, "info");
    },
  });

  pi.registerCommand("todos", {
    description: "Show current todo list",
    handler: async (_args, ctx) => {
      ctx.ui.notify(renderTodos(todoState), "info");
    },
  });

  pi.registerCommand("config", {
    description: "Show pi-pro config",
    handler: async (_args, ctx) => {
      try {
        const cfg = loadConfig();
        const lines = [
          `pi-pro config · v0.2.0`,
          `─`.repeat(40),
          `  provider:  ${cfg.provider.name}`,
          `  model:     ${cfg.provider.model}`,
          cfg.provider.baseUrl ? `  baseUrl:   ${cfg.provider.baseUrl}` : "",
          `  agent:     ${cfg.agent.name}`,
          `  max iter:  ${cfg.agent.maxIterations}`,
          `  tool budget: ${cfg.agent.toolBudget}`,
          `  modes:     ${getDefaultModes().map((m) => m.name).join(", ")}`,
        ].filter(Boolean);
        ctx.ui.notify(lines.join("\n"), "info");
      } catch (e) {
        ctx.ui.notify(`error loading config: ${(e as Error).message}`, "error");
      }
    },
  });

  pi.registerCommand("doctor", {
    description: "Check system + pi-pro config",
    handler: async (_args, ctx) => {
      const lines = ["pi-pro doctor", "─".repeat(40)];
      try {
        const cfg = loadConfig();
        const key = getEnvKey(cfg.provider.name);
        const theme = getTheme(cfg.theme?.name);
        const env = readColorEnv(process.env, cfg);
        const useColor = shouldUseColor(env);
        lines.push(`  provider:  ${cfg.provider.name}`);
        lines.push(`  model:     ${cfg.provider.model}`);
        lines.push(`  api key:   ${key ? `✓ ${maskKey(key)}` : "✗ (no key in env)"}`);
        lines.push(`  mode:      ${cfg.agent.name}${cfg.agent.name === "plan" ? " (read-only)" : ""}`);
        lines.push(`  theme:     ${theme.name} (${theme.label})`);
        lines.push(`  color:     ${useColor ? "✓ on" : "✗ off"} ${env.noColor ? "(NO_COLOR)" : env.termDumb ? "(TERM=dumb)" : env.copyFriendly ? "(copyFriendly)" : ""}`);
        lines.push(`  cwd:       ${process.cwd()}`);
        const git = readGit(process.cwd());
        if (git.branch) {
          const summary = summarizeGitStatus(git.porcelain, git.branch, git.ahead, git.behind, detectNerdFonts());
          lines.push(`  git:       ${git.branch} ${summary.icons}`);
        }
        const runtime = detectRuntime(process.cwd());
        if (runtime) lines.push(`  runtime:   ${formatRuntime(runtime)}`);
      } catch (e) {
        lines.push(`  error: ${(e as Error).message}`);
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("theme", {
    description: "Show / set theme (default, vivid, monokai, noir)",
    handler: async (args, ctx) => {
      const arg = args?.trim();
      if (!arg) {
        const cfg = loadConfig();
        const current = getTheme(cfg.theme?.name);
        for (const t of listThemes()) {
          const marker = t.name === current.name ? "→" : " ";
          const note = useColorFor(ctx)
            ? paint(`${marker} ${t.name}`, t.name === current.name ? "success" : "muted", t, true)
            : `${marker} ${t.name}`;
          ctx.ui.notify(`${note}  ${t.label} — ${t.description}`, "info");
        }
        return;
      }
      const target = listThemes().find((t) => t.name === arg);
      if (!target) {
        const names = listThemes().map((t) => t.name).join(", ");
        ctx.ui.notify(`unknown theme: ${arg} (available: ${names})`, "error");
        return;
      }
      const cfg = loadConfig();
      cfg.theme = { name: target.name };
      saveConfig(cfg);
      ctx.ui.notify(`theme: → ${target.name} (${target.label})`, "info");
    },
  });

  type TodoDetails = { items: TodoItem[]; nextId: number; action?: "list" | "add" | "toggle" | "clear"; error?: string; addedId?: number };

  pi.registerTool({
    name: "todo",
    label: "Todo",
    description: "Manage a todo list. Actions: list, add (text), toggle (id), clear.",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("list"), Type.Literal("add"), Type.Literal("toggle"), Type.Literal("clear")]),
      text: Type.Optional(Type.String()),
      id: Type.Optional(Type.Number()),
    }),
    async execute(_id, params) {
      const p = params as { action: "list" | "add" | "toggle" | "clear"; text?: string; id?: number };
      const text = (s: string) => [{ type: "text" as const, text: s }];
      if (p.action === "list") {
        return {
          content: text(renderTodos(todoState)),
          details: { items: todoState.items, nextId: todoState.nextId, action: "list" as const } as TodoDetails,
        };
      }
      if (p.action === "add") {
        const r = todoAdd(todoState, p.text ?? "");
        if (r.error) {
          return {
            content: text(`error: ${r.error}`),
            details: { items: todoState.items, nextId: todoState.nextId, error: r.error } as TodoDetails,
          };
        }
        todoState.items = r.state.items;
        todoState.nextId = r.state.nextId;
        const added = r.item!;
        return {
          content: text(`added #${added.id}: ${added.text}`),
          details: { items: todoState.items, nextId: todoState.nextId, action: "add" as const, addedId: added.id } as TodoDetails,
        };
      }
      if (p.action === "toggle") {
        if (p.id === undefined) {
          return {
            content: text("error: id required for toggle"),
            details: { items: todoState.items, nextId: todoState.nextId, error: "id required" } as TodoDetails,
          };
        }
        const r = todoToggle(todoState, p.id);
        todoState.items = r.state.items;
        todoState.nextId = r.state.nextId;
        if (r.error) {
          return {
            content: text(`error: ${r.error}`),
            details: { items: todoState.items, nextId: todoState.nextId, error: r.error } as TodoDetails,
          };
        }
        return {
          content: text(`toggled #${p.id}`),
          details: { items: todoState.items, nextId: todoState.nextId, action: "toggle" as const } as TodoDetails,
        };
      }
      if (p.action === "clear") {
        const cleared = todoState.items.length;
        const fresh = todoClear();
        todoState.items = fresh.items;
        todoState.nextId = fresh.nextId;
        return {
          content: text(`cleared ${cleared} todo(s)`),
          details: { items: [], nextId: 1, action: "clear" as const } as TodoDetails,
        };
      }
      return {
        content: text(`unknown action: ${p.action}`),
        details: { items: todoState.items, nextId: todoState.nextId, error: `unknown action: ${p.action}` } as TodoDetails,
      };
    },
  });

  pi.registerCommand("memory-add", {
    description: "Add a chunk to cross-session memory",
    handler: async (args, ctx) => {
      const text = args?.trim();
      if (!text) {
        ctx.ui.notify("usage: /memory-add <text>", "error");
        return;
      }
      const r = addMemory(memState, text, "narrative");
      Object.assign(memState, r.state);
      ctx.ui.notify(`✓ added #${r.entry.ts} (${memState.entries.length} total)`, "info");
    },
  });

  pi.registerCommand("memory-list", {
    description: "List memory entries (newest first)",
    handler: async (_args, ctx) => {
      const entries = listMemory(memState);
      if (entries.length === 0) {
        ctx.ui.notify("(no memory entries)", "info");
        return;
      }
      const lines = entries.slice(0, 20).map((e) => `  #${e.ts} [${e.role}] ${e.text.slice(0, 80)}`);
      if (entries.length > 20) lines.push(`  ... and ${entries.length - 20} more`);
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("memory-search", {
    description: "Search memory entries",
    handler: async (args, ctx) => {
      const q = args?.trim();
      if (!q) {
        ctx.ui.notify("usage: /memory-search <query>", "error");
        return;
      }
      const results = searchMemory(memState, q, 5);
      if (results.length === 0) {
        ctx.ui.notify(`no matches for: ${q}`, "info");
        return;
      }
      const lines = results.map((e) => `  #${e.ts} [${e.role}] ${e.text.slice(0, 100)}`);
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("memory-clear", {
    description: "Clear all memory entries",
    handler: async (_args, ctx) => {
      const n = memState.entries.length;
      const fresh = clearMemory(memState);
      Object.assign(memState, fresh);
      ctx.ui.notify(`✓ cleared ${n} entries`, "info");
    },
  });

  pi.registerCommand("btw", {
    description: "Side question (queues a message to the agent without polluting main history)",
    handler: async (args, ctx) => {
      const q = args?.trim();
      if (!q) {
        ctx.ui.notify("usage: /btw <question>", "error");
        return;
      }
      pi.sendUserMessage(`[side question, no edit] ${q}`);
      ctx.ui.notify(`queued btw: ${q.slice(0, 80)}`, "info");
    },
  });

  pi.registerCommand("context", {
    description: "Show context budget breakdown",
    handler: async (_args, ctx) => {
      const usage = (ctx as { getContextUsage?: () => { tokens: number; contextWindow: number; percent: number } | null }).getContextUsage?.();
      if (!usage) {
        ctx.ui.notify("(context usage not available)", "info");
        return;
      }
      const fmt = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
      const color = usage.percent < 0.75 ? "✓" : usage.percent < 0.9 ? "!" : "!!";
      ctx.ui.notify(`ctx: ${fmt(usage.tokens)}/${fmt(usage.contextWindow)} (${Math.round(usage.percent * 100)}%) ${color}`, "info");
    },
  });

  pi.registerShortcut("tab", {
    description: "Cycle agent mode (build ↔ plan). Overrides built-in Tab.",
    handler: async (_ctx) => {
      const current = getCurrentModeName();
      const next = cycleModeCfg(current, getDefaultModes());
      setModeName(next);
      applyActiveTools(next);
      _ctx.ui.notify(`mode: ${current} → ${next}`, "info");
    },
  });

  void useColorFor;
}
