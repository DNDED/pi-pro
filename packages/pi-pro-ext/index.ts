/**
 * pi-pro v0.2.5 — extension for pi-mono.
 *
 * Loaded automatically by `pi` when registered in ~/.pi/agent/settings.json.
 * Composes with pi-zentui (footer/editor chrome) and pi-ask-user (selection UI).
 *
 * This extension publishes:
 *   - "PI pro" header (above chat) with OSC 8 clickable links
 *   - Custom editor chrome — braille spinner in top border, model + thinking in bottom
 *   - "pi-pro" status (mode + version) picked up by pi-zentui
 *   - "pi-pro-plan" widget above editor for plan-mode progress
 *
 * Commands (single source of truth in src/commands.ts):
 *   mode, plan, todos, config, doctor, theme, apikey,
 *   memory-add, memory-list, memory-search, memory-clear,
 *   palette, help, btw, context
 *
 * Install: `pi install ./packages/pi-pro-ext`
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { parsePlanItems, markPlanDone, renderPlanWidget, isSafeBash } from "./src/plan-widget.js";
import { COMMANDS, type PaletteCommand } from "./src/commands.js";
import { buildStatusLine, VERSION } from "./src/pi-pro-meta.js";
import { applyOrng, resetTheme, currentThemeName } from "./src/theme-write.js";
import { freeCtrlP } from "./src/keybindings-write.js";
import { getCurrentModeName, setModeAndPersist, applyActiveTools } from "./src/mode.js";
import { refreshHeader, buildHeaderLines } from "./src/header.js";
import { openPalette } from "./src/palette.js";
import { installEditorChrome } from "./src/editor-chrome.js";
import { getPlanItems, setPlanItems, getLastPlanText, setLastPlanText, clearPlan, PLAN_WIDGET_KEY } from "./src/plan-runtime.js";

const STATUS_KEY = "pi-pro";
const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"];

let allToolNames: string[] = [];

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

type TodoDetails = { items: TodoItem[]; nextId: number; action?: "list" | "add" | "toggle" | "clear"; error?: string; addedId?: number };

function renderTodos(state: { items: TodoItem[]; nextId: number }): string {
  if (state.items.length === 0) return "  (no todos)";
  const done = state.items.filter((t) => t.done).length;
  const lines = [`  ${done}/${state.items.length} completed`];
  for (const t of state.items) {
    lines.push(`  ${t.done ? "v" : "o"} #${t.id} ${t.text}`);
  }
  return lines.join("\n");
}

function todoAdd(state: { items: TodoItem[]; nextId: number }, text: string) {
  if (!text.trim()) return { state, error: "text required for add" };
  const item: TodoItem = { id: state.nextId, text: text.trim(), done: false };
  return { state: { items: [...state.items, item], nextId: state.nextId + 1 }, item };
}
function todoToggle(state: { items: TodoItem[]; nextId: number }, id: number) {
  const item = state.items.find((t) => t.id === id);
  if (!item) return { state, error: `todo #${id} not found` };
  return { state: { items: state.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)), nextId: state.nextId } };
}

function registerCmd(pi: ExtensionAPI, name: string, opts: { description: string; handler: (args: string | undefined, ctx: any) => Promise<any> | any }): void {
  // pi-mono only parses /command (colon is treated as text by the LLM).
  pi.registerCommand(name, opts);
}

export default function (pi: ExtensionAPI): void {
  const todoState: { items: TodoItem[]; nextId: number } = { items: [], nextId: 1 };

  // ─── Wire all 12 commands from the manifest (data-driven registration) ───
  for (const c of COMMANDS) {
    const handler = async (args: string | undefined, ctx: any) => {
      const cc = {
        ui: ctx.ui,
        args,
        pi,
        ctx,
      };
      await c.run(cc);
    };
    registerCmd(pi, c.slashName, {
      description: `${c.title} — ${c.description}`,
      handler,
    });
  }

  // ─── Wire the todo tool (LLM-callable, stateful) ───
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
        return { content: text(renderTodos(todoState)), details: { items: todoState.items, nextId: todoState.nextId, action: "list" as const } as TodoDetails };
      }
      if (p.action === "add") {
        const r = todoAdd(todoState, p.text ?? "");
        if (r.error) return { content: text(`error: ${r.error}`), details: { items: todoState.items, nextId: todoState.nextId, error: r.error } as TodoDetails };
        todoState.items = r.state.items;
        todoState.nextId = r.state.nextId;
        return { content: text(`added #${r.item!.id}: ${r.item!.text}`), details: { items: todoState.items, nextId: todoState.nextId, action: "add" as const, addedId: r.item!.id } as TodoDetails };
      }
      if (p.action === "toggle") {
        if (p.id === undefined) return { content: text("error: id required"), details: { items: todoState.items, nextId: todoState.nextId, error: "id required" } as TodoDetails };
        const r = todoToggle(todoState, p.id);
        todoState.items = r.state.items;
        todoState.nextId = r.state.nextId;
        if (r.error) return { content: text(`error: ${r.error}`), details: { items: todoState.items, nextId: todoState.nextId, error: r.error } as TodoDetails };
        return { content: text(`toggled #${p.id}`), details: { items: todoState.items, nextId: todoState.nextId, action: "toggle" as const } as TodoDetails };
      }
      if (p.action === "clear") {
        const cleared = todoState.items.length;
        todoState.items = [];
        todoState.nextId = 1;
        return { content: text(`cleared ${cleared}`), details: { items: [], nextId: 1, action: "clear" as const } as TodoDetails };
      }
      return { content: text("unknown action"), details: { items: todoState.items, nextId: todoState.nextId, error: "unknown" } as TodoDetails };
    },
  });

  // ─── Tab shortcut for mode cycle (informational warning, accepted per Sid) ───
  pi.registerShortcut("tab", {
    description: "Cycle agent mode (build <-> plan).",
    handler: async (ctx) => {
      const current = getCurrentModeName();
      const { cycleMode } = await import("@pi-pro/config");
      const next = cycleMode(current);
      setModeAndPersist(next, ctx.ui, pi, allToolNames);
      ctx.ui.notify(`mode: ${current} -> ${next}`, "info");
    },
  });

  // ─── Ctrl+P shortcut for command palette (after keybinding rebind) ───
  pi.registerShortcut("ctrl+p", {
    description: "Open the pi-pro command palette (fuzzy search).",
    handler: async (ctx) => {
      const cc = { ui: ctx.ui, args: undefined, pi, ctx };
      await openPalette(ctx, pi, COMMANDS, { ui: ctx.ui });
    },
  });

  // ─── Editor chrome (border-status-editor pattern) ───
  installEditorChrome(pi);

  // ─── session_start: header + status + tools + theme + keybindings ───
  pi.on("session_start", async (_event, ctx) => {
    // 1. Header (PI pro) — OSC 8 links
    refreshHeader(ctx.ui);

    // 2. Snapshot all tools for plan→build restoration
    try { allToolNames = pi.getAllTools().map((t) => t.name); } catch { allToolNames = []; }
    applyActiveTools(pi, getCurrentModeName(), allToolNames);

    // 3. pi-pro status (picked up by pi-zentui's footer)
    ctx.ui.setStatus(STATUS_KEY, buildStatusLine(VERSION, getCurrentModeName()));

    // 4. Apply orange theme (idempotent, driven by piPro.theme in our config)
    const theme = currentThemeName();
    if (theme === "orng") applyOrng("orng");

    // 5. Free Ctrl+P (write keybindings.json + trigger reload)
    const r = freeCtrlP();
    if (r.wrote) {
      try { (ctx as any).reload?.(); } catch { /* next session */ }
    }

    // 6. First-run notice
    if (ctx.hasUI) {
      const note = `pi-pro v${VERSION} · ${getCurrentModeName()}${getCurrentModeName() === "plan" ? " (read-only)" : ""} · theme: ${theme} · Ctrl+P for palette`;
      ctx.ui.notify(note, "info");
    }
  });

  // ─── Plan-mode enforcement ───
  pi.on("tool_call", async (event) => {
    if (getCurrentModeName() !== "plan") return;
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
    if (getCurrentModeName() !== "plan") return;
    return {
      message: {
        customType: "pi-pro-plan-mode",
        content:
          `[PLAN MODE ACTIVE]\n` +
          `You are in plan mode — a read-only exploration mode.\n\n` +
          `Restrictions:\n- Tools: read, bash (filtered), grep, find, ls\n` +
          `- Bash: blocked by DESTRUCTIVE_PATTERNS (rm -rf, sudo, chmod 777, git push, etc.)\n` +
          `- NO edits, writes, or file modifications\n\n` +
          `Describe plans under a "Plan:" header with numbered steps.\n` +
          `Mark steps done with [DONE:n] markers.`,
        display: false,
      },
    };
  });

  // ─── Plan widget (parses plan text from agent) ───
  pi.on("agent_end", async (event, ctx) => {
    if (getCurrentModeName() !== "plan") return;
    const last = [...(event.messages as { role: string; content: unknown }[])].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const text = typeof last.content === "string" ? last.content : JSON.stringify(last.content);
    if (text !== getLastPlanText()) {
      setLastPlanText(text);
      setPlanItems(parsePlanItems(text));
    }
    if (getPlanItems().length > 0) {
      markPlanDone(text, getPlanItems());
      const lines = renderPlanWidget(getPlanItems());
      if (lines.length > 0) {
        try {
          (ctx.ui as any).setWidget(PLAN_WIDGET_KEY, lines, { placement: "aboveEditor" } as any);
        } catch { /* ignore */ }
      }
    }
  });

  pi.on("turn_end", async (event, ctx) => {
    if (getCurrentModeName() !== "plan") return;
    if (getPlanItems().length === 0) return;
    const lastMsg = (event.message ?? null) as { content?: unknown } | null;
    if (!lastMsg) return;
    const text = typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content ?? "");
    markPlanDone(text, getPlanItems());
    const lines = renderPlanWidget(getPlanItems());
    if (lines.length > 0) {
      try {
        (ctx.ui as any).setWidget(PLAN_WIDGET_KEY, lines, { placement: "aboveEditor" } as any);
      } catch { /* ignore */ }
    }
  });

  pi.on("session_shutdown", async () => {
    clearPlan({ setWidget: () => {} } as any);
  });
}
