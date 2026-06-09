import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface ToolCallCardProps {
  name: string;
  status: "running" | "pass" | "fail" | "blocked";
  summary: string;
  details?: string;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ name, status, summary, details }) => {
  const statusColor = {
    running: theme.warn,
    pass: theme.success,
    fail: theme.error,
    blocked: theme.error,
  }[status];
  const icon = { running: "◐", pass: "✓", fail: "✗", blocked: "!" }[status];
  return (
    <Box borderStyle="round" borderColor={theme.border} flexDirection="column" paddingX={1} marginY={1}>
      <Box>
        <Text color={statusColor}>{icon} </Text>
        <Text bold color={theme.text}>{name}</Text>
        <Text color={theme.textDim}>  {summary}</Text>
      </Box>
      {details && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={theme.textDim}>{details}</Text>
        </Box>
      )}
    </Box>
  );
};
