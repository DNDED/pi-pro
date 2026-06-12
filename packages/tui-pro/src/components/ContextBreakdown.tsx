import React from "react";
import { Box, Text } from "ink";
import { theme, formatTokens, formatCost } from "../theme.js";
import type { ContextStats } from "@pi/context-manager";

export interface ContextBreakdownProps {
  stats: ContextStats | null;
  /** Per-category token counts for the breakdown. */
  breakdown: {
    system: number;
    memory: number;
    codebase: number;
    tools: number;
    conversation: number;
  };
  maxTokens: number;
}

export interface ContextCategory {
  label: string;
  tokens: number;
  color: string;
}

export function buildCategories(breakdown: ContextBreakdownProps["breakdown"]): ContextCategory[] {
  return [
    { label: "system",      tokens: breakdown.system,      color: theme.textMuted },
    { label: "memory",      tokens: breakdown.memory,      color: theme.info },
    { label: "codebase",    tokens: breakdown.codebase,    color: theme.secondary },
    { label: "tools",       tokens: breakdown.tools,       color: theme.accent },
    { label: "conversation",tokens: breakdown.conversation,color: theme.primary },
  ];
}

export function ContextBreakdown({ stats, breakdown, maxTokens }: ContextBreakdownProps): React.ReactElement {
  const cats = buildCategories(breakdown);
  const total = cats.reduce((s, c) => s + c.tokens, 0);
  const pct = (n: number) => (maxTokens > 0 ? Math.round((n / maxTokens) * 100) : 0);
  const stateColor = stats ? (stats.state === "hard-trigger" ? theme.error : stats.state === "soft-warn" ? theme.warning : theme.success) : theme.textMuted;
  const stateLabel = stats ? (stats.state === "hard-trigger" ? "HARD" : stats.state === "soft-warn" ? "WARN" : "OK") : "OFF";

  return (
    <Box flexDirection="column" paddingX={2} borderStyle="single" borderColor={theme.border}>
      <Box>
        <Text color={theme.text} bold>Context breakdown</Text>
        <Text color={theme.textMuted}>  ({formatTokens(total)}/{formatTokens(maxTokens)})</Text>
        <Text color={stateColor}>  [{stateLabel}]</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {cats.map(c => (
          <Box key={c.label}>
            <Text color={c.label === "conversation" ? theme.text : theme.textMuted}>{c.label.padEnd(13)}</Text>
            <Text color={c.color}>{formatTokens(c.tokens).padStart(7)}</Text>
            <Text color={theme.textMuted}>  ({pct(c.tokens)}%)</Text>
          </Box>
        ))}
      </Box>
      {stats && stats.triggeredReasons.length > 0 ? (
        <Box marginTop={1}>
          <Text color={theme.warning}>triggers: {stats.triggeredReasons.join(", ")}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text color={theme.textMuted}>turn {stats?.turnCount ?? 0} · {formatCost(stats?.totalCostUsd ?? 0)} · {stats?.messageCount ?? 0} msg</Text>
      </Box>
    </Box>
  );
}

export default ContextBreakdown;
