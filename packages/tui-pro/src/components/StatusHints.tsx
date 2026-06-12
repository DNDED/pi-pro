import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { Spinner } from "./Spinner.js";

export interface StatusHintsProps {
  running: boolean;
  statusText?: string;
  agent?: string;
  elapsed?: number;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

export function StatusHints({ running, statusText, agent = "build", elapsed = 0 }: StatusHintsProps) {
  return (
    <Box justifyContent="space-between" paddingX={2}>
      <Box>
        {running ? (
          <>
            <Spinner label={statusText} />
            <Text color={theme.textMuted}>  {formatElapsed(elapsed)}</Text>
          </>
        ) : null}
      </Box>
      <Box>
        {running ? (
          <Text color={theme.textMuted}>
            <Text bold>esc</Text> interrupt
          </Text>
        ) : (
          <Text color={theme.textMuted}>
            <Text bold>ctrl+t</Text> variants   <Text bold>tab</Text> agents   <Text bold>ctrl+p</Text> commands
          </Text>
        )}
      </Box>
    </Box>
  );
}

export default StatusHints;
