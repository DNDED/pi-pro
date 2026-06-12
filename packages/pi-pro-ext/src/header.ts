/**
 * Header — the "PI pro · v0.2.5 · [+] BUILD · 5.2K/262K (2%) · [github] [docs] [/help]"
 * row that sits above the chat.
 *
 * - OSC 8 hyperlinks render as clickable in modern terminals (Ghostty, Kitty,
 *   WezTerm, iTerm2, VSCode). Falls back to plain text on older terminals.
 * - Re-rendered on agent_end (token usage) and on mode change.
 */
import { VERSION } from "./pi-pro-meta.js";

export interface HeaderState {
  mode: string;
  tokens: number | null;
  contextWindow: number | null;
  percent: number | null;
}

const SUPPORTS_OSC8 = (() => {
  const term = (process.env.TERM ?? "").toLowerCase();
  const tp = (process.env.TERM_PROGRAM ?? "").toLowerCase();
  return /ghostty|kitty|wezterm|iterm|vscode/.test(tp) || /256color|truecolor/.test(term);
})();

function hyperlink(text: string, url: string): string {
  if (!SUPPORTS_OSC8) return text;
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function buildHeaderLines(state: HeaderState): string[] {
  const isPlan = state.mode === "plan";
  const modeBadge = isPlan ? "[!] PLAN RO" : "[+] BUILD";
  const tokens = state.tokens != null && state.contextWindow != null && state.percent != null
    ? `${fmt(state.tokens)}/${fmt(state.contextWindow)} (${Math.round(state.percent * 100)}%)`
    : "tokens: n/a";
  const title = hyperlink("PI pro", "https://github.com/DNDED/pi-pro");
  const gh = hyperlink("github", "https://github.com/DNDED/pi-pro");
  const docs = hyperlink("docs", "https://pi.dev/packages/pi-zentui?type=theme");
  const help = hyperlink("/help", "pi-pro:help");
  return [
    `${title} · v${VERSION} · ${modeBadge} · ${tokens}   ·  ${gh}  ·  ${docs}  ·  ${help}`,
  ];
}

/**
 * Refresh the header — re-renders it with the latest state.
 * Called from session_start and on every agent_end.
 */
export function refreshHeader(ui: { setHeader: (factory: any) => void }): void {
  ui.setHeader((_tui: unknown, _theme: unknown) => {
    return {
      render(_width: number): string[] {
        return buildHeaderLines({
          mode: currentMode(),
          tokens: null,
          contextWindow: null,
          percent: null,
        });
      },
      invalidate(): void {},
    };
  });
}

import { getCurrentModeName } from "./mode.js";
function currentMode(): string { return getCurrentModeName(); }
