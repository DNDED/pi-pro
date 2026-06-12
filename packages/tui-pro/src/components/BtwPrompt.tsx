import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import type { BtwResult } from "@pi/context-manager";

export interface BtwPromptProps {
  visible: boolean;
  question: string;
  result: BtwResult | null;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function BtwPrompt({
  visible,
  question,
  result,
  loading,
  onChange,
  onSubmit,
  onCancel,
}: BtwPromptProps): React.ReactElement | null {
  if (!visible) return null;
  return (
    <Box flexDirection="column" paddingX={2} borderStyle="round" borderColor={theme.accent}>
      <Box>
        <Text color={theme.accent} bold>btw </Text>
        <Text color={theme.textMuted}>(side question — won't pollute main history)</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text}>? </Text>
        <Text color={theme.text}>{question || " "}</Text>
      </Box>
      {result ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.textMuted}>↳ {result.answer}</Text>
          <Box marginTop={1}>
            <Text color={theme.textMuted}>esc to dismiss</Text>
          </Box>
        </Box>
      ) : loading ? (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>thinking...</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>enter to ask · esc to cancel</Text>
        </Box>
      )}
    </Box>
  );
}

export default BtwPrompt;
