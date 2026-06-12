import React from "react";
import { Box, Text } from "ink";
import { theme, formatTokens } from "../theme.js";
import type { ContextState, ContextStats } from "@pi/context-manager";

export interface ContextBudgetProps {
  stats: ContextStats | null;
  /** Optional max context for the bar. Defaults to computing from stats + budgetUsed. */
  maxTokens?: number;
  /** Bar width in characters. */
  barWidth?: number;
  /** Compact mode for Footer embedding (single line). */
  compact?: boolean;
}

export type ContextBudgetColor = "ok" | "warn" | "danger";

export function colorForState(state: ContextState): ContextBudgetColor {
  if (state === "hard-trigger") return "danger";
  if (state === "soft-warn") return "warn";
  return "ok";
}

export function colorHex(state: ContextState): string {
  const c = colorForState(state);
  if (c === "danger") return theme.error;
  if (c === "warn") return theme.warning;
  return theme.success;
}

export function buildBar(used: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round(used * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function formatBudgetLine(stats: ContextStats, maxTokens?: number): string {
  const used = Math.max(0, Math.round(stats.totalTokens));
  const max = maxTokens ?? (stats.budgetUsed > 0 ? Math.round(used / stats.budgetUsed) : used);
  const pct = Math.round(stats.budgetUsed * 100);
  return `ctx:${formatTokens(used)}/${formatTokens(max)} (${pct}%)`;
}

export function ContextBudget({
  stats,
  maxTokens,
  barWidth = 20,
  compact = false,
}: ContextBudgetProps): React.ReactElement {
  if (!stats) {
    return (
      <Box>
        <Text color={theme.textMuted}>ctx:off</Text>
      </Box>
    );
  }

  const color = colorHex(stats.state);
  const label = formatBudgetLine(stats, maxTokens);

  if (compact) {
    return (
      <Box>
        <Text color={color}>{label}</Text>
      </Box>
    );
  }

  const bar = buildBar(stats.budgetUsed, barWidth);
  return (
    <Box flexDirection="column" paddingX={2} borderStyle="single" borderColor={color}>
      <Box justifyContent="space-between">
        <Box>
          <Text color={theme.textMuted}>ctx </Text>
          <Text color={color} bold>{label}</Text>
        </Box>
        <Box>
          <Text color={theme.textMuted}>
            turn {stats.turnCount} · {formatCostShort(stats.totalCostUsd)}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={color}>{bar}</Text>
        <Text color={theme.textMuted}> </Text>
        <Text color={color}>{Math.round(stats.budgetUsed * 100)}%</Text>
      </Box>
      {stats.triggeredReasons.length > 0 ? (
        <Box>
          <Text color={theme.warning}>  triggers: {stats.triggeredReasons.join(", ")}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function formatCostShort(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export default ContextBudget;
