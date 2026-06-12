import React from "react";
import { Box, useStdout } from "ink";
import { theme } from "../theme.js";
import { BlockLogo } from "./BlockLogo.js";
import { PromptInput } from "./PromptInput.js";
import { Footer } from "./Footer.js";
import { StatusHints } from "./StatusHints.js";

export interface HomeScreenProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  agent?: string;
  model?: string;
  provider?: string;
  workdir?: string;
  branch?: string;
  version?: string;
}

export function HomeScreen({
  value,
  onChange,
  onSubmit,
  agent = "build",
  model,
  provider,
  workdir,
  branch,
  version,
}: HomeScreenProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const promptMaxWidth = Math.max(40, Math.min(75, Math.floor(cols * 0.7)));
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexGrow={1} />
      <Box alignItems="center" flexDirection="column" marginBottom={1}>
        <BlockLogo />
      </Box>
      <Box paddingX={2} alignItems="center" flexDirection="column">
        <Box width={promptMaxWidth}>
          <PromptInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            agent={agent}
            model={model}
            provider={provider}
            width={promptMaxWidth}
          />
        </Box>
      </Box>
      <Box flexGrow={1} />
      <StatusHints running={false} agent={agent} />
      <Footer workdir={workdir} branch={branch} version={version} />
    </Box>
  );
}

export default HomeScreen;
