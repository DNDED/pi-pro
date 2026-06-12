import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { formatTokens, formatCost } from "../theme.js";

export interface StarshipFooterProps {
  workdir?: string;
  branch?: string | null;
  gitIcons?: string;
  runtime?: string | null;
  contextUsed?: number | null;
  contextMax?: number | null;
  contextLabel?: string;
  cacheHitRate?: number;
  costUsd?: number;
  agentMode?: string;
  agentModeReadOnly?: boolean;
  todoDone?: number | null;
  todoTotal?: number | null;
  planDone?: number | null;
  planTotal?: number | null;
  version?: string;
  nerdFonts?: boolean;
}

function pct(used: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.round((used / max) * 100)}%`;
}

function contextColor(used: number, max: number): string {
  if (max <= 0) return theme.textMuted;
  const r = used / max;
  if (r < 0.75) return theme.textMuted;
  if (r < 0.9) return theme.warning;
  return theme.error;
}

export function StarshipFooter({
  workdir = process.cwd(),
  branch = null,
  gitIcons = "",
  runtime = null,
  contextUsed = null,
  contextMax = null,
  contextLabel = "ctx",
  cacheHitRate,
  costUsd = 0,
  agentMode = "build",
  agentModeReadOnly = false,
  todoDone = null,
  todoTotal = null,
  planDone = null,
  planTotal = null,
  version = "0.8.4",
  nerdFonts = true,
}: StarshipFooterProps) {
  const cwd = workdir.split("/").pop() ?? workdir;
  const cwdIcon = nerdFonts ? "󰝰 " : "";
  return (
    <Box justifyContent="space-between" paddingX={2}>
      <Box>
        <Text color={theme.info}>{cwdIcon}{cwd}</Text>
        {branch ? (
          <Text color={theme.accent}>  on {branch}{gitIcons ? ` ${gitIcons}` : ""}</Text>
        ) : null}
        {runtime ? <Text color={theme.textMuted}>  via {runtime}</Text> : null}
        {agentMode ? (
          <Text color={theme.primary}>  [{agentMode.toUpperCase()}{agentModeReadOnly ? " RO" : ""}]</Text>
        ) : null}
        {todoTotal !== null && todoDone !== null ? (
          <Text color={theme.accent}>  ☰ {todoDone}/{todoTotal}</Text>
        ) : null}
        {planTotal !== null && planDone !== null ? (
          <Text color={theme.warning}>  📋 {planDone}/{planTotal}</Text>
        ) : null}
      </Box>
      <Box>
        {contextUsed !== null && contextMax !== null ? (
          <Text color={contextColor(contextUsed, contextMax)}>
            {contextLabel}:{formatTokens(contextUsed)}/{formatTokens(contextMax)} ({pct(contextUsed, contextMax)})  </Text>
        ) : null}
        {cacheHitRate !== undefined && cacheHitRate > 0 ? (
          <Text color={theme.success}>cache:{Math.round(cacheHitRate * 100)}%  </Text>
        ) : null}
        {costUsd > 0 ? <Text color={theme.success}>{formatCost(costUsd)}  </Text> : null}
        <Text color={theme.textMuted}>
          <Text color={theme.success}>•</Text> <Text bold>pi-pro</Text> v{version}
        </Text>
      </Box>
    </Box>
  );
}

export default StarshipFooter;
