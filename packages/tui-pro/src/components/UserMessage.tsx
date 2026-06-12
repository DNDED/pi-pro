import React from "react";
import { Box, Text } from "ink";
import { theme, formatTime } from "../theme.js";

export interface FilePill {
  type: "image" | "pdf" | "file";
  label: string;
  mime?: string;
}

export interface UserMessageProps {
  text: string;
  agent?: string;
  time?: number;
  shareUrl?: string;
  files?: FilePill[];
}

function pillBg(type: FilePill["type"]): string {
  if (type === "image") return theme.accent;
  if (type === "pdf") return theme.primary;
  return theme.secondary;
}

function pillLabel(type: FilePill["type"], mime?: string): string {
  if (type === "image") return "img";
  if (type === "pdf") return "pdf";
  return mime?.split("/")[1]?.slice(0, 4) ?? "file";
}

export function UserMessage({ text, agent, time, shareUrl, files }: UserMessageProps) {
  const lines = text.split("\n");
  const firstLine = lines[0] ?? "";
  const rest = lines.slice(1).join("\n");
  const isTitle = firstLine.startsWith("# ");
  const title = isTitle ? firstLine.slice(2) : "";
  const body = isTitle ? rest : text;

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box flexDirection="row">
        <Text color={theme.accent} bold>
          {isTitle ? `# ${title}` : firstLine}
        </Text>
        {shareUrl ? (
          <Box marginLeft={2}>
            <Text color={theme.textMuted}>{shareUrl}</Text>
          </Box>
        ) : null}
      </Box>
      {body && !isTitle ? null : null}
      {body && !isTitle ? (
        <Box marginTop={1}>
          <Text color={theme.text} wrap="wrap">{body}</Text>
        </Box>
      ) : null}
      {files && files.length > 0 ? (
        <Box marginTop={1} flexDirection="row">
          {files.map((f, i) => (
            <Box key={i} marginRight={1} paddingX={1}>
              <Text color={theme.background}>{pillLabel(f.type, f.mime)}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
      {time ? (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>{formatTime(time)}</Text>
          {agent ? (
            <>
              <Text color={theme.textMuted}>  ·  </Text>
              <Text color={theme.textMuted}>{agent}</Text>
            </>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

export default UserMessage;
