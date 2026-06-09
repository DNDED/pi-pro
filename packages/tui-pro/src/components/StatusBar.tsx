import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface StatusBarProps {
  state: string;
  taskId?: string;
  tokensUsed?: number;
  tokensBudget?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({ state, taskId, tokensUsed, tokensBudget }) => {
  const pct = tokensUsed && tokensBudget ? Math.round((tokensUsed / tokensBudget) * 100) : 0;
  return (
    <Box borderStyle="single" borderColor={theme.border} paddingX={1} justifyContent="space-between">
      <Box>
        <Text color={theme.accent}>pi-pro</Text>
        <Text color={theme.textDim}>  state: </Text>
        <Text color={theme.text}>{state}</Text>
        {taskId && (
          <>
            <Text color={theme.textDim}>  task: </Text>
            <Text color={theme.text}>{taskId}</Text>
          </>
        )}
      </Box>
      {tokensUsed !== undefined && tokensBudget !== undefined && (
        <Text color={pct > 80 ? theme.warn : theme.textDim}>ctx {pct}%</Text>
      )}
    </Box>
  );
};
