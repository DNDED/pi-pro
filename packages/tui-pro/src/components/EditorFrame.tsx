import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface EditorFrameProps {
  agent?: string;
  model?: string;
  provider?: string;
  copyFriendly?: boolean;
  width?: number | string;
  children?: React.ReactNode;
  topBorder?: boolean;
  bottomBorder?: boolean;
}

function borderColor(active: boolean): string {
  return active ? theme.borderActive : theme.border;
}

export function EditorFrame({
  agent = "build",
  model,
  provider,
  copyFriendly = false,
  width = "100%",
  children,
  topBorder = true,
  bottomBorder = true,
}: EditorFrameProps) {
  const accent = (theme as unknown as Record<string, string>)[agent] ?? theme.primary;
  const bc = borderColor(true);
  const rail = copyFriendly ? " " : "┃";
  const railColor = copyFriendly ? theme.textMuted : accent;
  return (
    <Box flexDirection="column" width={width}>
      {topBorder ? (
        <Box>
          <Text color={railColor}>{rail}</Text>
          <Box flexGrow={1}>
            <Text> </Text>
          </Box>
        </Box>
      ) : null}
      <Box flexDirection="row" width="100%">
        <Text color={railColor}>{rail}</Text>
        <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1}>
          {children}
        </Box>
      </Box>
      <Box>
        <Text color={railColor}>{rail}</Text>
        <Box flexGrow={1} flexDirection="row" justifyContent="space-between" paddingX={2}>
          <Box>
            <Text color={accent}>{agent}</Text>
            {model ? (
              <>
                <Text>  </Text>
                <Text color={theme.text}>{model}</Text>
              </>
            ) : null}
            {provider ? (
              <>
                <Text>  </Text>
                <Text color={theme.textMuted}>{provider}</Text>
              </>
            ) : null}
          </Box>
          <Box>
            <Text color={bc}>─</Text>
          </Box>
        </Box>
      </Box>
      {bottomBorder ? (
        <Box>
          <Text color={railColor}>{rail}</Text>
          <Box flexGrow={1}>
            <Text> </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

export default EditorFrame;
