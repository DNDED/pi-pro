export interface TuiTheme {
  name: string;
  background: string;
  backgroundPanel: string;
  backgroundElement: string;
  text: string;
  textMuted: string;
  border: string;
  borderActive: string;
  borderSubtle: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  diffAdded: string;
  diffAddedBg: string;
  diffRemoved: string;
  diffRemovedBg: string;
  diffContext: string;
  diffLineNumber: string;
  diffAddedLineNumberBg: string;
  diffRemovedLineNumberBg: string;
}

export const theme: TuiTheme = {
  name: "promyra",
  background: "#0a0a0a",
  backgroundPanel: "#141414",
  backgroundElement: "#1e1e1e",
  text: "#eeeeee",
  textMuted: "#808080",
  border: "#484848",
  borderActive: "#606060",
  borderSubtle: "#3c3c3c",
  primary: "#fab283",
  secondary: "#5c9cf5",
  accent: "#9d7cd8",
  success: "#7fd88f",
  warning: "#f5a742",
  error: "#e06c75",
  info: "#56b6c2",
  diffAdded: "#4fd6be",
  diffAddedBg: "#20303b",
  diffRemoved: "#c53b53",
  diffRemovedBg: "#37222c",
  diffContext: "#828bb8",
  diffLineNumber: "#8f8f8f",
  diffAddedLineNumberBg: "#1b2b34",
  diffRemovedLineNumberBg: "#2d1f26",
};

export const agentColors: Record<string, string> = {
  build: theme.primary,
  plan: theme.secondary,
  search: theme.info,
  audit: theme.warning,
  review: theme.accent,
  general: theme.text,
};

export function agentColor(name: string): string {
  return agentColors[name] ?? theme.primary;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-fA-F0-9]{6})$/.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}

export function tint(base: string, overlay: string, alpha: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(overlay);
  if (!a || !b) return base;
  const t = Math.max(0, Math.min(1, alpha));
  const r = Math.round(a.r * (1 - t) + b.r * t);
  const g = Math.round(a.g * (1 - t) + b.g * t);
  const bl = Math.round(a.b * (1 - t) + b.b * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default theme;
