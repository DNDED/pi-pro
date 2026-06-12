/**
 * pi-pro theme system — colors for footer, plan widget, notifications.
 *
 * Themes are named token palettes. The renderer emits ANSI 24-bit (truecolor)
 * when the terminal supports it, else 256-color, else plain text.
 *
 * Color is suppressed when:
 *   - NO_COLOR env var is set (https://no-color.org)
 *   - TERM=dumb
 *   - ui.copyFriendly is true in pi-pro config
 */
import type { PiConfig } from "@pi-pro/config";

export type ColorName = "accent" | "muted" | "success" | "warning" | "danger" | "info";

export interface ThemeToken {
  hex: string;
  bold?: boolean;
}

export interface Theme {
  name: string;
  label: string;
  description: string;
  tokens: Record<ColorName, ThemeToken>;
}

export const THEMES: Record<string, Theme> = {
  default: {
    name: "default",
    label: "Default",
    description: "Subtle monochrome with a single cyan accent",
    tokens: {
      accent: { hex: "#22d3ee" },
      muted: { hex: "#94a3b8" },
      success: { hex: "#22c55e" },
      warning: { hex: "#eab308" },
      danger: { hex: "#ef4444" },
      info: { hex: "#60a5fa" },
    },
  },
  vivid: {
    name: "vivid",
    label: "Vivid",
    description: "Full-color palette for dark terminals",
    tokens: {
      accent: { hex: "#a78bfa", bold: true },
      muted: { hex: "#a1a1aa" },
      success: { hex: "#10b981", bold: true },
      warning: { hex: "#f59e0b", bold: true },
      danger: { hex: "#f43f5e", bold: true },
      info: { hex: "#38bdf8" },
    },
  },
  monokai: {
    name: "monokai",
    label: "Monokai",
    description: "Classic Monokai palette",
    tokens: {
      accent: { hex: "#66d9ef" },
      muted: { hex: "#75715e" },
      success: { hex: "#a6e22e" },
      warning: { hex: "#e6db74" },
      danger: { hex: "#f92672" },
      info: { hex: "#fd971f" },
    },
  },
  noir: {
    name: "noir",
    label: "Noir",
    description: "Pure black-and-white for paper / pipes / logs",
    tokens: {
      accent: { hex: "#ffffff" },
      muted: { hex: "#cccccc" },
      success: { hex: "#ffffff", bold: true },
      warning: { hex: "#ffffff", bold: true },
      danger: { hex: "#ffffff", bold: true },
      info: { hex: "#ffffff" },
    },
  },
};

export function getTheme(name: string | undefined): Theme {
  if (!name) return THEMES.default!;
  return THEMES[name] ?? THEMES.default!;
}

export function listThemes(): Theme[] {
  return Object.values(THEMES);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 128, g: 128, b: 128 };
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export interface ColorEnv {
  noColor: boolean;
  termDumb: boolean;
  copyFriendly: boolean;
  noTty: boolean;
}

export function readColorEnv(env: NodeJS.ProcessEnv, cfg: PiConfig | null): ColorEnv {
  return {
    noColor: !!env.NO_COLOR || !!env.no_color,
    termDumb: (env.TERM ?? "").toLowerCase() === "dumb",
    copyFriendly: cfg?.ui?.copyFriendly ?? false,
    noTty: !env.TERM && !(env as Record<string, string | undefined>).COLORTERM,
  };
}

export function shouldUseColor(env: ColorEnv): boolean {
  if (env.noColor) return false;
  if (env.termDumb) return false;
  if (env.copyFriendly) return false;
  if (env.noTty) return false;
  return true;
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function ansiFg(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function paint(text: string, color: ColorName, theme: Theme, useColor: boolean): string {
  if (!useColor) return text;
  const token = theme.tokens[color];
  if (!token) return text;
  const open = (token.bold ? BOLD : "") + ansiFg(token.hex);
  return `${open}${text}${RESET}`;
}

export function paintMany(parts: Array<{ text: string; color?: ColorName }>, theme: Theme, useColor: boolean): string {
  return parts
    .map((p) => (p.color ? paint(p.text, p.color, theme, useColor) : p.text))
    .join("");
}
