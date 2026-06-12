import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { Message, MessagePart } from "../events.js";
import { UserMessage } from "./UserMessage.js";
import { AssistantMessage } from "./AssistantMessage.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { PromptInput } from "./PromptInput.js";
import { Footer } from "./Footer.js";
import { Sidebar } from "./Sidebar.js";
import { StatusHints } from "./StatusHints.js";
import { HeaderRow } from "./HeaderRow.js";
import { SubagentFooter } from "./SubagentFooter.js";
import { PermissionPrompt, PermissionRequest } from "./PermissionPrompt.js";
import { SessionMeta } from "../events.js";

export interface SessionScreenProps {
  messages: Message[];
  meta?: SessionMeta;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  running: boolean;
  statusText?: string;
  agent?: string;
  model?: string;
  provider?: string;
  workdir?: string;
  branch?: string;
  showSidebar?: boolean;
  version?: string;
  permissionRequest?: PermissionRequest;
  subagent?: { label: string; index: number; total: number; tokens: number; cost: number };
  startTime?: number;
}

function renderMessage(m: Message, key: string): React.ReactNode {
  if (m.role === "user") {
    return (
      <UserMessage
        key={key}
        text={m.parts.map((p) => p.text ?? "").join("\n")}
        agent={m.agent}
        time={m.time}
      />
    );
  }
  if (m.role === "error") {
    return <ErrorMessage key={key} text={m.parts.map((p) => p.text ?? "").join("\n")} />;
  }
  return (
    <AssistantMessage
      key={key}
      parts={m.parts}
      model={m.model}
      agent={m.agent}
      time={m.time}
    />
  );
}

export function SessionScreen({
  messages,
  meta,
  value,
  onChange,
  onSubmit,
  running,
  statusText,
  agent = "build",
  model,
  provider,
  workdir,
  branch,
  showSidebar = false,
  version,
  permissionRequest,
  subagent,
  startTime,
}: SessionScreenProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <HeaderRow
        title={meta?.title}
        shareUrl={meta?.shareUrl}
        tokensIn={meta?.tokensIn}
        tokensOut={meta?.tokensOut}
        cost={meta?.cost}
        agent={meta?.agent ?? agent}
      />
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1} paddingX={2} paddingBottom={1}>
          <Box flexDirection="column" flexGrow={1}>
            {messages.length === 0 ? (
              <Box paddingY={2}>
                <Text color={theme.textMuted}>Start typing to begin a session...</Text>
              </Box>
            ) : (
              messages.map((m, i) => renderMessage(m, `m${i}`))
            )}
          </Box>
          {permissionRequest ? (
            <Box marginTop={1}>
              <PermissionPrompt request={permissionRequest} />
            </Box>
          ) : null}
          {subagent ? (
            <Box marginTop={1}>
              <SubagentFooter
                label={subagent.label}
                index={subagent.index}
                total={subagent.total}
                tokens={subagent.tokens}
                cost={subagent.cost}
              />
            </Box>
          ) : null}
          <Box marginTop={1} flexDirection="column">
            <PromptInput
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              agent={agent}
              model={model ?? meta?.model}
              provider={provider ?? meta?.provider}
            />
            <Box marginTop={0}>
              <StatusHints
                running={running}
                statusText={statusText}
                agent={agent}
                elapsed={startTime ? Date.now() - startTime : 0}
              />
            </Box>
          </Box>
        </Box>
        {showSidebar ? (
          <Sidebar
            title={meta?.title}
            sessionId={meta?.id}
            workdir={workdir ?? meta?.workdir}
            agent={agent}
            model={model ?? meta?.model}
            provider={provider ?? meta?.provider}
            version={version}
          />
        ) : null}
      </Box>
      <Footer workdir={workdir} branch={branch} version={version} tab={`[${(agent ?? "build").toUpperCase()}]`} />
    </Box>
  );
}

export default SessionScreen;
