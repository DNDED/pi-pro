import React from "react";
import { Box, Text } from "ink";
import { theme, formatCost, formatTokens } from "../theme.js";
import type { ContextStats } from "@pi/context-manager";
import { colorForState, formatBudgetLine } from "./ContextBudget.js";

export interface TurnDelta {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs?: number;
  turnNumber?: number;
  toolCalls?: number;
}

export interface FooterProps {
  workdir?: string;
  branch?: string;
  permissions?: number;
  lsp?: number;
  mcp?: number;
  mcpError?: boolean;
  connected?: boolean;
  version?: string;
  tab?: string;
  /** v0.5.0: per-turn token counts. */
  tokensIn?: number;
  tokensOut?: number;
  /** v0.5.0: session cost in USD. */
  costUsd?: number;
  /** v0.5.0: cache hit rate 0..1. */
  cacheHitRate?: number;
  /** v0.5.0: elapsed wall time. */
  elapsedMs?: number;
  /** v0.7.0: context stats from ContextManager. */
  contextStats?: ContextStats | null;
  /** v0.7.0: max context tokens for the budget bar. */
  contextMaxTokens?: number;
  /** v0.8.0: per-turn delta (last LLM call's usage). */
  turnDelta?: TurnDelta | null;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

function formatDelta(d: TurnDelta): string {
  const parts: string[] = [];
  parts.push(`Δtok:${formatTokens(d.tokensIn)}↗/${formatTokens(d.tokensOut)}↘`);
  if (d.costUsd > 0) parts.push(formatCost(d.costUsd));
  if (d.toolCalls !== undefined && d.toolCalls > 0) parts.push(`${d.toolCalls}🔧`);
  if (d.durationMs !== undefined && d.durationMs > 0) parts.push(formatElapsed(d.durationMs));
  return parts.join(" ");
}

export function Footer({
  workdir = process.cwd(),
  branch,
  permissions = 0,
  lsp = 0,
  mcp = 0,
  mcpError = false,
  connected = true,
  version = "0.8.0",
  tab,
  tokensIn = 0,
  tokensOut = 0,
  costUsd = 0,
  cacheHitRate,
  elapsedMs = 0,
  contextStats = null,
  contextMaxTokens,
  turnDelta = null,
}: FooterProps) {
  const showCost = connected && (tokensIn > 0 || tokensOut > 0 || costUsd > 0);
  const costStr = costUsd > 0 ? formatCost(costUsd) : "$0.00";
  const showContext = connected && contextStats !== null;
  const ctxColor = showContext ? colorForState(contextStats!.state) : theme.textMuted;
  const showTurn = connected && turnDelta !== null && (turnDelta.tokensIn > 0 || turnDelta.tokensOut > 0);
  return (
    <Box justifyContent="space-between" paddingX={2}>
      <Box>
        <Text color={theme.textMuted}>{workdir}{branch ? `:${branch}` : ""}</Text>
        {connected ? (
          <>
            <Text color={theme.textMuted}>  </Text>
            {permissions > 0 ? (
              <>
                <Text color={theme.warning}>△ {permissions}</Text>
                <Text color={theme.textMuted}>  </Text>
              </>
            ) : null}
            {mcp > 0 ? (
              <>
                <Text color={mcpError ? theme.error : theme.success}>⊙ {mcp} MCP</Text>
                <Text color={theme.textMuted}>  </Text>
              </>
            ) : null}
            <Text color={theme.textMuted}>/status</Text>
          </>
        ) : (
          <Text color={theme.text}>  Get started <Text color={theme.textMuted}>/connect</Text></Text>
        )}
      </Box>
      <Box>
        {showTurn ? (
          <Text color={theme.accent}>
            {formatDelta(turnDelta!)}  </Text>
        ) : null}
        {showCost ? (
          <Text color={theme.textMuted}>
            tok:{formatTokens(tokensIn)}↗/{formatTokens(tokensOut)}↘  {costStr}
            {cacheHitRate !== undefined && cacheHitRate > 0 ? `  cache:${Math.round(cacheHitRate * 100)}%` : ""}
            {elapsedMs > 0 ? `  ${formatElapsed(elapsedMs)}` : ""}  </Text>
        ) : null}
        {showContext ? (
          <Text color={ctxColor}>
            {formatBudgetLine(contextStats!, contextMaxTokens)}  </Text>
        ) : null}
        {tab ? <Text color={theme.textMuted}>{tab}  </Text> : null}
        <Text color={theme.textMuted}>
          <Text color={theme.success}>•</Text> <Text bold>pi-pro</Text> v{version}
        </Text>
      </Box>
    </Box>
  );
}

export default Footer;
