import React from "react";
import { Box, Text, useInput } from "ink";
import { theme, agentColor } from "../theme.js";

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  agent?: string;
  model?: string;
  provider?: string;
  disabled?: boolean;
  width?: number | string;
}

const EmptyBorder = {
  topLeft: " ",
  topRight: " ",
  bottomLeft: " ",
  bottomRight: " ",
  vertical: " ",
  horizontal: " ",
  topT: " ",
  bottomT: " ",
  leftT: " ",
  rightT: " ",
  cross: " ",
};

const SplitBorder = {
  ...EmptyBorder,
  vertical: "┃",
  bottomLeft: "╹",
};

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function wordForward(text: string, from: number): number {
  if (from >= text.length) return text.length;
  let i = from;
  const atWord = /\w/.test(text[i] ?? "");
  if (atWord) {
    while (i < text.length && /\w/.test(text[i] ?? "")) i++;
  }
  while (i < text.length && !/\w/.test(text[i] ?? "")) i++;
  return i;
}

function wordBackward(text: string, from: number): number {
  if (from <= 0) return 0;
  let i = from;
  if (i > text.length) i = text.length;
  while (i > 0 && !/\w/.test(text[i - 1] ?? "")) i--;
  while (i > 0 && /\w/.test(text[i - 1] ?? "")) i--;
  return i;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask anything... "Fix a TODO in the codebase"',
  agent = "build",
  model,
  provider,
  disabled = false,
  width = "100%",
}: PromptInputProps) {
  const accent = agentColor(agent);
  const [cursor, setCursor] = React.useState<number>(value.length);
  const lastValueRef = React.useRef<string>(value);

  React.useEffect(() => {
    if (value !== lastValueRef.current) {
      const delta = value.length - lastValueRef.current.length;
      if (delta > 0) {
        setCursor((c) => clamp(c + delta, 0, value.length));
      } else if (delta < 0) {
        const removedAt = lastValueRef.current.length + delta;
        setCursor((c) => clamp(removedAt < c && c <= removedAt - delta ? removedAt : c, 0, value.length));
      }
      lastValueRef.current = value;
    }
  }, [value]);

  useInput((input: string, key: Record<string, boolean>) => {
    if (disabled) return;
    if (key.return) {
      const trimmed = value.trim();
      if (trimmed.length > 0) onSubmit(trimmed);
      return;
    }
    if (key.ctrl && input === "c") {
      process.exit(0);
    }
    if (key.escape) {
      onChange("");
      setCursor(0);
      return;
    }

    if (key.leftArrow) {
      setCursor((c) => clamp(c - 1, 0, value.length));
      return;
    }
    if (key.rightArrow) {
      setCursor((c) => clamp(c + 1, 0, value.length));
      return;
    }
    if (key.home) {
      setCursor(0);
      return;
    }
    if (key.end) {
      setCursor(value.length);
      return;
    }

    if (input === "h" && !key.ctrl && !key.meta) {
      setCursor((c) => clamp(c - 1, 0, value.length));
      return;
    }
    if (input === "l" && !key.ctrl && !key.meta) {
      setCursor((c) => clamp(c + 1, 0, value.length));
      return;
    }
    if (input === "0" && !key.ctrl && !key.meta) {
      setCursor(0);
      return;
    }
    if (input === "$" && !key.ctrl && !key.meta) {
      setCursor(value.length);
      return;
    }
    if (input === "w" && !key.ctrl && !key.meta) {
      setCursor((c) => wordForward(value, c + 1));
      return;
    }
    if (input === "b" && !key.ctrl && !key.meta) {
      setCursor((c) => wordBackward(value, c));
      return;
    }
    if (input === "e" && !key.ctrl && !key.meta) {
      let i = clamp(cursor + 1, 0, value.length);
      while (i < value.length && !/\w/.test(value[i] ?? "")) i++;
      while (i < value.length && /\w/.test(value[i] ?? "")) i++;
      setCursor(clamp(i, 0, value.length));
      return;
    }

    if (key.ctrl && input === "w") {
      const newCursor = wordBackward(value, cursor);
      const next = value.slice(0, newCursor) + value.slice(cursor);
      onChange(next);
      setCursor(newCursor);
      return;
    }
    if (key.ctrl && input === "u") {
      onChange(value.slice(cursor));
      setCursor(0);
      return;
    }
    if (key.ctrl && input === "a") {
      setCursor(0);
      return;
    }
    if (key.ctrl && input === "e") {
      setCursor(value.length);
      return;
    }

    if (key.backspace || key.delete) {
      if (cursor > 0) {
        const next = value.slice(0, cursor - 1) + value.slice(cursor);
        onChange(next);
        setCursor(clamp(cursor - 1, 0, next.length));
      } else if (key.delete && cursor < value.length) {
        const next = value.slice(0, cursor) + value.slice(cursor + 1);
        onChange(next);
      }
      return;
    }
    if (key.delete && cursor < value.length) {
      const next = value.slice(0, cursor) + value.slice(cursor + 1);
      onChange(next);
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
      const next = value.slice(0, cursor) + input + value.slice(cursor);
      onChange(next);
      setCursor(clamp(cursor + input.length, 0, next.length));
      return;
    }
  });

  const placeholderText = placeholder;
  const displayText = value || placeholderText;
  const textColor = value ? theme.text : theme.textMuted;
  const before = value.slice(0, cursor);
  const at = value[cursor] ?? "";
  const after = value.slice(cursor + at.length);

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" width="100%">
        <Text color={accent}>┃</Text>
        <Box
          flexGrow={1}
          flexDirection="column"
          paddingX={2}
          paddingY={1}
        >
          <Text color={textColor} wrap="wrap">
            {value ? (
              <>
                {before}
                {!disabled ? <Text color={theme.accent} inverse>{at || " "}</Text> : null}
                {after}
              </>
            ) : (
              <>
                {placeholderText}
                {!disabled ? <Text color={theme.text}>▌</Text> : null}
              </>
            )}
          </Text>
          <Box marginTop={1} justifyContent="space-between">
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
            <Text color={theme.textMuted}>esc:clear  ^w:del-word  h/l:move  w/b:word  0/$:line</Text>
          </Box>
        </Box>
      </Box>
      <Box flexDirection="row" width="100%">
        <Text color={accent}>┃</Text>
        <Box flexGrow={1}>
          <Text> </Text>
        </Box>
      </Box>
    </Box>
  );
}

export { wordForward, wordBackward };
export default PromptInput;
