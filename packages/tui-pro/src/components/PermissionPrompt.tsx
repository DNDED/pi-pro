import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface PermissionRequest {
  id: string;
  permission: string;
  tool: string;
  args: Record<string, unknown>;
  title?: string;
  patterns?: string[];
}

export interface PermissionPromptProps {
  request: PermissionRequest;
  onOnce?: () => void;
  onAlways?: () => void;
  onReject?: () => void;
  selected?: 0 | 1 | 2;
}

const OPTIONS = ["Once", "Always", "Reject"] as const;

function headerIcon(permission: string): string {
  if (permission === "bash") return "#";
  if (permission === "edit") return "✎";
  if (permission === "read") return "→";
  if (permission === "webfetch") return "%";
  if (permission === "websearch") return "◈";
  if (permission === "doom_loop") return "⟳";
  return "⚙";
}

export function PermissionPrompt({ request, selected = 0, onOnce, onAlways, onReject }: PermissionPromptProps) {
  return (
    <Box flexDirection="column">
      <Box
        borderStyle="single"
        borderColor={theme.warning}
       
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Box>
          <Text color={theme.warning}>△ </Text>
          <Text color={theme.warning} bold>Permission required</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text}>{headerIcon(request.permission)} </Text>
          <Text color={theme.text} bold>{request.tool}</Text>
          {request.title ? <Text color={theme.textMuted}> · {request.title}</Text> : null}
        </Box>
        {Object.keys(request.args).length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            {Object.entries(request.args).slice(0, 5).map(([k, v]) => (
              <Box key={k}>
                <Text color={theme.textMuted}>{k}: </Text>
                <Text color={theme.text}>{typeof v === "string" ? v : JSON.stringify(v)}</Text>
              </Box>
            ))}
          </Box>
        ) : null}
        <Box marginTop={1} flexDirection="row">
          {OPTIONS.map((opt, i) => {
            const isSel = i === selected;
            return (
              <Box key={opt} marginRight={2} paddingX={1}>
                <Text color={isSel ? theme.background : theme.text} bold={isSel}>{opt}</Text>
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1}>
          <Text color={theme.textMuted}>←/→ select  ·  enter confirm  ·  esc reject</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default PermissionPrompt;
