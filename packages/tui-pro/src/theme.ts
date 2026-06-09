export const theme = {
  accent: "#7C3AED",
  accentMuted: "#5B21B6",
  success: "#10B981",
  warn: "#F59E0B",
  error: "#EF4444",
  muted: "#6B7280",
  border: "#374151",
  bg: "#0B0F17",
  bgPanel: "#111827",
  text: "#E5E7EB",
  textDim: "#9CA3AF",
} as const;

export type Theme = typeof theme;
