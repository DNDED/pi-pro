import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { classifyTool, formatToolArgs } from "../events.js";
import { renderDiff } from "../util/diff.js";

export interface ToolContentProps {
  tool: string;
  args?: Record<string, unknown>;
  result?: string;
  status?: "running" | "done" | "error";
}

function headerText(name: string, args: Record<string, unknown> | undefined): { label: string; value: string; icon: string; iconColor: string } {
  const argStr = formatToolArgs(args);
  const kind = classifyTool(name);
  let icon = "*";
  let iconColor = theme.accent;
  if (kind === "read") {
    icon = "→";
    iconColor = theme.secondary;
  } else if (kind === "bash") {
    icon = "$";
    iconColor = theme.success;
  } else if (kind === "grep" || kind === "glob") {
    icon = "*";
    iconColor = theme.accent;
  } else if (kind === "task") {
    icon = "#";
    iconColor = theme.warning;
  } else if (kind === "webfetch") {
    icon = "↗";
    iconColor = theme.info;
  } else if (kind === "edit" || kind === "write") {
    icon = "✎";
    iconColor = theme.primary;
  } else if (kind === "todo") {
    icon = "▢";
    iconColor = theme.textMuted;
  }
  return { label: name, value: argStr, icon, iconColor };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function syntaxColor(s: string): string {
  if (/^\s*(import|export|const|let|var|function|class|return|if|else|for|while|async|await|interface|type|enum)\b/.test(s)) return theme.accent;
  if (/^\s*(["'`])([^"'`]*)\1/.test(s)) return theme.success;
  if (/^\s*(\/\/|\/\*|\#)/.test(s)) return theme.textMuted;
  if (/^\s*[{}()[\];,]/.test(s)) return theme.textMuted;
  return theme.text;
}

export function ToolContent({ tool, args, result, status }: ToolContentProps) {
  const head = headerText(tool, args);
  const argStr = head.value;
  const kind = classifyTool(tool);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Text color={head.iconColor}>{head.icon} {head.label}</Text>
        {argStr ? <Text color={theme.textMuted}> {argStr}</Text> : null}
        {status === "running" ? <Text color={theme.textMuted}> ...</Text> : null}
        {status === "done" ? <Text color={theme.success}> ✓</Text> : null}
        {status === "error" ? <Text color={theme.error}> ✗</Text> : null}
      </Box>
      {result && status !== "running" ? (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          {kind === "read" || kind === "write" || kind === "edit" ? (
            <FileContent path={argStr} result={result} kind={kind} />
          ) : kind === "bash" ? (
            <BashOutput result={result} />
          ) : kind === "grep" ? (
            <GrepResults result={result} />
          ) : kind === "glob" ? (
            <GlobResults result={result} />
          ) : kind === "webfetch" ? (
            <WebfetchContent result={result} />
          ) : kind === "task" ? (
            <TaskResult result={result} />
          ) : (
            <Text color={theme.textMuted}>{truncate(result, 200)}</Text>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

function FileContent({ path, result, kind }: { path: string; result: string; kind: string }) {
  if (kind === "edit") {
    const oldText = (result.match(/OLD:\n([\s\S]*?)(?:\nNEW:|$)/)?.[1] ?? "");
    const newText = (result.match(/NEW:\n([\s\S]*?)$/)?.[1] ?? result);
    return <DiffView oldText={oldText} newText={newText} path={path} />;
  }
  const lines = result.split("\n");
  const truncated = lines.length > 30;
  const display = truncated ? lines.slice(0, 30) : lines;
  return (
    <Box flexDirection="column">
      {display.map((line, i) => (
        <Box key={i} flexDirection="row">
          <Box width={4} justifyContent="flex-end">
            <Text color={theme.diffLineNumber}>{`${i + 1}`.padStart(3)} </Text>
          </Box>
          <Text color={syntaxColor(line)} wrap="wrap">{line || " "}</Text>
        </Box>
      ))}
      {truncated ? (
        <Text color={theme.textMuted}>… and {lines.length - 30} more lines</Text>
      ) : null}
    </Box>
  );
}

function DiffView({ oldText, newText, path }: { oldText: string; newText: string; path: string }) {
  const lines = renderDiff(oldText, newText);
  return (
    <Box flexDirection="column">
      {lines.map((l, i) => {
        const isAdd = l.kind === "added";
        const isRem = l.kind === "removed";
        const bg = isAdd ? theme.diffAddedBg : isRem ? theme.diffRemovedBg : undefined;
        const fg = isAdd ? theme.diffAdded : isRem ? theme.diffRemoved : theme.diffContext;
        const prefix = isAdd ? "+" : isRem ? "-" : " ";
        return (
          <Box key={i} flexDirection="row">
            <Box width={4} justifyContent="flex-end">
              <Text color={theme.diffLineNumber}>{`${l.line}`.padStart(3)} </Text>
            </Box>
            <Text color={fg}>{prefix} {l.text || " "}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function BashOutput({ result }: { result: string }) {
  const lines = result.split("\n");
  const truncated = lines.length > 20;
  const display = truncated ? lines.slice(0, 20) : lines;
  return (
    <Box flexDirection="column">
      {display.map((line, i) => (
        <Text key={i} color={theme.text} wrap="wrap">{line || " "}</Text>
      ))}
      {truncated ? (
        <Text color={theme.textMuted}>… and {lines.length - 20} more lines</Text>
      ) : null}
    </Box>
  );
}

function GrepResults({ result }: { result: string }) {
  const lines = result.split("\n").filter((l) => l.trim());
  const truncated = lines.length > 10;
  const display = truncated ? lines.slice(0, 10) : lines;
  return (
    <Box flexDirection="column">
      {display.map((line, i) => {
        const m = /^([^:]+):(\d+):(.*)$/.exec(line);
        if (m) {
          return (
            <Box key={i} flexDirection="row">
              <Text color={theme.textMuted}>{m[1]}:</Text>
              <Text color={theme.info}>{m[2]}</Text>
              <Text color={theme.textMuted}>:</Text>
              <Text color={theme.text}>{m[3]}</Text>
            </Box>
          );
        }
        return <Text key={i} color={theme.text}>{line}</Text>;
      })}
      {truncated ? (
        <Text color={theme.textMuted}>… and {lines.length - 10} more matches</Text>
      ) : null}
    </Box>
  );
}

function GlobResults({ result }: { result: string }) {
  const lines = result.split("\n").filter((l) => l.trim());
  return (
    <Box flexDirection="column">
      {lines.slice(0, 15).map((line, i) => (
        <Text key={i} color={theme.secondary}>{line}</Text>
      ))}
      {lines.length > 15 ? (
        <Text color={theme.textMuted}>… and {lines.length - 15} more files</Text>
      ) : null}
    </Box>
  );
}

function WebfetchContent({ result }: { result: string }) {
  const lines = result.split("\n");
  return (
    <Box flexDirection="column">
      {lines.slice(0, 20).map((line, i) => (
        <Text key={i} color={theme.text} wrap="wrap">{line || " "}</Text>
      ))}
      {lines.length > 20 ? (
        <Text color={theme.textMuted}>… and {lines.length - 20} more lines</Text>
      ) : null}
    </Box>
  );
}

function TaskResult({ result }: { result: string }) {
  return (
    <Text color={theme.textMuted} wrap="wrap">{truncate(result, 200)}</Text>
  );
}

export default ToolContent;
