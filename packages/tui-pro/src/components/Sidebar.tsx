import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface SidebarProps {
  title?: string;
  sessionId?: string;
  workdir?: string;
  agent?: string;
  model?: string;
  provider?: string;
  shareUrl?: string;
  version?: string;
}

function PanelLine({ children, color = theme.textMuted, bg = theme.backgroundPanel }: { children: React.ReactNode; color?: string; bg?: string }) {
  return <Text color={color}>{children}</Text>;
}

export function Sidebar({
  title = "New session",
  sessionId,
  workdir,
  agent = "build",
  model,
  provider,
  shareUrl,
  version = "0.8.0",
}: SidebarProps) {
  return (
    <Box
      width={42}
      flexDirection="column"
      paddingX={2}
      paddingY={1}
    >
      <Box flexDirection="column" paddingRight={1}>
        <Text color={theme.text} bold>{title}</Text>
        {sessionId ? <Text color={theme.textMuted}>{sessionId}</Text> : null}
        {workdir ? <Text color={theme.textMuted}>{workdir}</Text> : null}
        {shareUrl ? <Text color={theme.textMuted}>{shareUrl}</Text> : null}
      </Box>
      <Box flexDirection="column" marginTop={1} paddingRight={1}>
        <Text color={theme.textMuted}>agent: <Text color={theme.text}>{agent}</Text></Text>
        {model ? <Text color={theme.textMuted}>model: <Text color={theme.text}>{model}</Text></Text> : null}
        {provider ? <Text color={theme.textMuted}>provider: <Text color={theme.text}>{provider}</Text></Text> : null}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.textMuted}>
          <Text color={theme.success}>•</Text> <Text color={theme.text} bold>promyra</Text> v{version}
        </Text>
      </Box>
    </Box>
  );
}

export default Sidebar;
