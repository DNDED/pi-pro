/**
 * Editor chrome — braille spinner in the top border, model + thinking level
 * in the bottom border. OpenCode-style.
 *
 * Built on the `border-status-editor.ts` example from pi-mono's examples/ dir.
 * Hides pi-mono's built-in working indicator with setWorkingVisible(false)
 * so we don't have two spinners going at once.
 */
import type { Component, EditorTheme, TUI } from "@earendil-works/pi-tui";
import { CustomEditor, type ExtensionAPI, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface ChromeState {
  isWorking: boolean;
  spinnerIndex: number;
  timer?: ReturnType<typeof setInterval>;
  tui?: TUI;
}

let state: ChromeState = { isWorking: false, spinnerIndex: 0 };

function stopSpinner(): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }
}

function fitBorder(left: string, right: string, width: number, color: (s: string) => string): string {
  if (width <= 0) return "";
  const border = (s: string) => color(s);
  const leftVis = visibleWidth(left);
  const rightVis = visibleWidth(right);
  if (leftVis + rightVis + 3 > width) {
    let r = right;
    while (visibleWidth(r) + leftVis + 3 > width && r.length > 0) r = r.slice(0, -1);
    right = r;
  }
  if (leftVis + rightVis + 3 > width) {
    let l = left;
    while (visibleWidth(l) + rightVis + 3 > width && l.length > 0) l = l.slice(0, -1);
    left = l;
  }
  const used = visibleWidth(left) + visibleWidth(right);
  const fill = Math.max(0, width - used - 2);
  return `${border("─")}${left}${"─".repeat(fill)}${right}${border("─")}`;
}

function formatThinking(level: string | undefined): string {
  if (!level || level === "off") return "thinking off";
  return `thinking ${level}`;
}

class BorderChromeEditor extends CustomEditor {
  private topLeft = "";
  private bottomLeft = "";
  private bottomRight = "";
  private api?: ExtensionAPI;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, api: ExtensionAPI) {
    super(tui, theme, keybindings, { paddingX: 0 });
    state.tui = tui;
    this.api = api;
  }

  setApi(api: ExtensionAPI): void { this.api = api; }

  private refreshLabels(): void {
    const color = (s: string) => this.borderColor(s);
    const isPlan = this.api && readMode(this.api) === "plan";
    this.topLeft = state.isWorking ? color(` ${SPINNER_FRAMES[state.spinnerIndex]} `) : "";
    this.bottomLeft = color(` ${this.modelString()} · ${this.thinkingString()}${isPlan ? " · RO" : ""} `);
    this.bottomRight = "";
  }

  private modelString(): string {
    try {
      const m = this.api && (this.api as any).getModel?.();
      if (m && typeof m === "object" && "provider" in m && "id" in m) {
        return `${(m as any).provider}/${(m as any).id}`;
      }
    } catch { /* ignore */ }
    return "no model";
  }

  private thinkingString(): string {
    try {
      const t = this.api && (this.api as any).getThinkingLevel?.();
      return formatThinking(t);
    } catch { return formatThinking("off"); }
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length < 2) return lines;
    this.refreshLabels();
    const color = (s: string) => this.borderColor(s);
    lines[0] = fitBorder(this.topLeft, this.bottomRight, width, color);
    lines[lines.length - 1] = fitBorder(this.bottomLeft, "", width, color);
    return lines;
  }
}

function readMode(_api: ExtensionAPI): string {
  try { return (require("@pi-pro/config") as typeof import("@pi-pro/config")).loadConfig().agent.name; } catch { return "build"; }
}

export function installEditorChrome(pi: ExtensionAPI): void {
  let editor: BorderChromeEditor | undefined;
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWorkingVisible(false);
    ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
      editor = new BorderChromeEditor(tui, theme, keybindings, pi);
      return editor;
    });
  });

  pi.on("agent_start", () => {
    state.isWorking = true;
    stopSpinner();
    state.timer = setInterval(() => {
      state.spinnerIndex = (state.spinnerIndex + 1) % SPINNER_FRAMES.length;
      state.tui?.requestRender();
    }, 80);
    state.tui?.requestRender();
  });

  pi.on("agent_end", () => {
    state.isWorking = false;
    stopSpinner();
    state.tui?.requestRender();
  });

  pi.on("session_shutdown", () => {
    stopSpinner();
    state.tui = undefined;
    state = { isWorking: false, spinnerIndex: 0 };
  });
}
