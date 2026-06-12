import React from "react";
import { Box, Text } from "ink";
import { theme, formatTokens, formatCost, agentColor } from "../theme.js";

export interface HeaderRowProps {
  title?: string;
  shareUrl?: string;
  tokensIn?: number;
  tokensOut?: number;
  contextLimit?: number;
  cost?: number;
  agent?: string;
}

function tokenPct(tokens: number, limit?: number): string {
  if (!limit) return "";
  return `${Math.round((tokens / limit) * 100)}%`;
}

export function HeaderRow({ title, shareUrl, tokensIn = 0, tokensOut = 0, contextLimit, cost = 0, agent = "build" }: HeaderRowProps) {
  const total = tokensIn + tokensOut;
  const pct = tokenPct(total, contextLimit);
  const displayTitle = title?.startsWith("# ") ? title.slice(2) : title;
  const accent = agentColor(agent);
  return (
    <Box justifyContent="space-between" paddingX={2} paddingY={1}>
      <Box>
        {displayTitle ? (
          <Text color={accent} bold># {displayTitle}</Text>
        ) : null}
        {shareUrl ? (
          <Box marginLeft={2}>
            <Text color={theme.textMuted}>{shareUrl}</Text>
          </Box>
        ) : null}
      </Box>
      {total > 0 || cost > 0 ? (
        <Text color={theme.textMuted}>
          {formatTokens(total)}{pct ? `/${pct}` : ""} {cost > 0 ? `(${formatCost(cost)})` : ""}
        </Text>
      ) : null}
    </Box>
  );
}

export default HeaderRow;
