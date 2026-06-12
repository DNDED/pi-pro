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
  const promptRef = React.useRef<{ onKey: (input: string, key: Record<string, boolean>) => void } | null>(null);

  React.useEffect(() => {
    promptRef.current = {
      onKey: (input: string, key: Record<string, boolean>) => {
        if (disabled) return;
        if (key.return) {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            onSubmit(trimmed);
          }
          return;
        }
        if (key.backspace || key.delete) {
          onChange(value.slice(0, -1));
          return;
        }
        if (key.ctrl && input === "c") {
          process.exit(0);
        }
        if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
          onChange(value + input);
        }
      },
    };
  }, [value, disabled, onChange, onSubmit]);

  useInput((input: string, key: Record<string, boolean>) => {
    promptRef.current?.onKey(input, key);
  });

  const placeholderText = placeholder;
  const displayText = value || placeholderText;
  const textColor = value ? theme.text : theme.textMuted;

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
            {displayText}
            {!disabled ? <Text color={theme.text}>▌</Text> : null}
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

export default PromptInput;
