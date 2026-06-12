import React from "react";
import { Box, Text } from "ink";
import { theme, agentColor } from "../theme.js";

export interface SubagentFooterProps {
  label?: string;
  index?: number;
  total?: number;
  tokens?: number;
  cost?: number;
  parentId?: string;
  onParent?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function SubagentFooter({
  label = "Subagent",
  index = 0,
  total = 0,
  tokens = 0,
  cost = 0,
  parentId,
  onParent,
  onPrev,
  onNext,
}: SubagentFooterProps) {
  return (
    <Box
      borderStyle="single"
      borderColor={theme.border}
     
      paddingX={2}
      paddingY={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Box>
          <Text color={theme.text} bold>{label}</Text>
          {total > 0 ? (
            <Text color={theme.textMuted}> ({index} of {total})</Text>
          ) : null}
          {tokens > 0 ? (
            <Text color={theme.textMuted}>  {tokens.toLocaleString()}</Text>
          ) : null}
          {cost > 0 ? (
            <Text color={theme.textMuted}>  ${cost.toFixed(2)}</Text>
          ) : null}
        </Box>
        <Box>
          {onParent ? (
            <>
              <Text color={theme.text}>Parent </Text>
              <Text color={theme.textMuted}>↑</Text>
              <Text color={theme.textMuted}>  </Text>
            </>
          ) : null}
          {onPrev ? (
            <>
              <Text color={theme.text}>Prev </Text>
              <Text color={theme.textMuted}>opt+↑</Text>
              <Text color={theme.textMuted}>  </Text>
            </>
          ) : null}
          {onNext ? (
            <>
              <Text color={theme.text}>Next </Text>
              <Text color={theme.textMuted}>opt+↓</Text>
            </>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

export default SubagentFooter;
