import React from "react";
import { Box, Text } from "ink";
import { theme, formatTime, agentColor } from "../theme.js";
import { MessagePart, classifyTool, formatToolArgs } from "../events.js";
import { ToolContent } from "./ToolContent.js";
import { renderMarkdown } from "./Markdown.js";

export interface AssistantMessageProps {
  parts: MessagePart[];
  model?: string;
  agent?: string;
  time?: number;
  showMeta?: boolean;
}

function renderPart(part: MessagePart, key: string): React.ReactNode {
  if (part.kind === "text" && part.text) {
    return renderMarkdown(part.text, key);
  }
  if (part.kind === "tool" && part.toolName) {
    return (
      <Box key={key} flexDirection="column" marginY={1}>
        <ToolContent
          tool={part.toolName}
          args={part.args}
          result={part.result}
          status={part.status}
        />
      </Box>
    );
  }
  if (part.kind === "reasoning" && part.text) {
    return (
      <Box key={key} paddingX={1}>
        <Text color={theme.textMuted} italic>{part.text}</Text>
      </Box>
    );
  }
  return null;
}

export function AssistantMessage({ parts, model, agent, time, showMeta = true }: AssistantMessageProps) {
  const accent = agent ? agentColor(agent) : theme.text;
  return (
    <Box flexDirection="column" paddingY={1}>
      {parts.map((p, i) => renderPart(p, `p${i}`))}
      {showMeta && model ? (
        <Box marginTop={1} flexDirection="row">
          {agent ? (
            <Text color={accent}>{agent}</Text>
          ) : null}
          {agent ? <Text>  </Text> : null}
          <Text color={theme.text}>{model}</Text>
          {time ? (
            <>
              <Text>  </Text>
              <Text color={theme.textMuted}>({formatTime(time)})</Text>
            </>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

export default AssistantMessage;
