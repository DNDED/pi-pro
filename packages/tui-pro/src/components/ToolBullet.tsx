import React from "react";
import { Text, Box } from "ink";
import { theme } from "../theme.js";
import { ToolKind, classifyTool } from "../events.js";

export interface ToolBulletProps {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status?: "running" | "done" | "error";
  formatArgs?: (args: Record<string, unknown> | undefined) => string;
}

export function formatArgs(args: Record<string, unknown> | undefined): string {
  if (!args) return "";
  const a = args as Record<string, unknown>;
  if (typeof a.path === "string") return a.path;
  if (typeof a.file_path === "string") return a.file_path;
  if (typeof a.command === "string") return a.command;
  if (typeof a.cmd === "string") return a.cmd;
  if (typeof a.pattern === "string") return a.pattern;
  if (typeof a.query === "string") return a.query;
  if (typeof a.url === "string") return a.url;
  if (typeof a.description === "string") return a.description;
  return "";
}

function bulletFor(kind: ToolKind): string {
  if (kind === "read") return "→";
  if (kind === "bash") return "$";
  if (kind === "grep" || kind === "glob") return "*";
  if (kind === "task") return "#";
  if (kind === "webfetch") return "↗";
  if (kind === "todo") return "▢";
  return "*";
}

function colorFor(kind: ToolKind, status?: string): string {
  if (status === "error") return theme.error;
  if (kind === "read") return theme.secondary;
  if (kind === "bash") return theme.success;
  if (kind === "grep" || kind === "glob") return theme.accent;
  if (kind === "task") return theme.warning;
  if (kind === "webfetch") return theme.info;
  if (kind === "edit" || kind === "write") return theme.primary;
  return theme.text;
}

export function ToolBullet({ name, args, result, status, formatArgs: fmt }: ToolBulletProps) {
  const kind = classifyTool(name);
  const bullet = bulletFor(kind);
  const color = colorFor(kind, status);
  const argStr = (fmt ?? formatArgs)(args);
  const display = argStr ? ` ${argStr}` : "";
  return (
    <Box>
      <Text color={color}>{bullet} {name}</Text>
      {display ? <Text color={theme.textMuted}>{display}</Text> : null}
      {status === "running" ? <Text color={theme.textMuted}> ...</Text> : null}
      {result && status === "done" ? <Text color={theme.textMuted}> ✓</Text> : null}
      {status === "error" ? <Text color={theme.error}> ✗</Text> : null}
    </Box>
  );
}

export function StatusBullet({ text }: { text: string }) {
  return (
    <Box>
      <Text color={theme.textMuted}>~ {text}</Text>
    </Box>
  );
}

export default ToolBullet;
