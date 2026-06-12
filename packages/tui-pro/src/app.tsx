import React, { useEffect, useState } from "react";
import { Box, useStdout } from "ink";
import { theme } from "./theme.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { SessionScreen } from "./components/SessionScreen.js";
import {
  onEvent,
  TuiEvent,
  Message,
  SessionMeta,
  RouteName,
  classifyTool,
  PermissionRequestEvent,
} from "./events.js";

export interface AppProps {
  initialTask?: string;
  workdir?: string;
  branch?: string;
  model?: string;
  provider?: string;
  agent?: string;
  version?: string;
}

let msgId = 0;
function nextId(): string {
  msgId += 1;
  return `m${msgId}-${Date.now()}`;
}

export function App({
  initialTask,
  workdir,
  branch,
  model,
  provider,
  agent = "build",
  version = "0.8.0",
}: AppProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;

  const [route, setRoute] = useState<RouteName>(initialTask ? "session" : "home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>(initialTask ?? "");
  const [running, setRunning] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [meta, setMeta] = useState<SessionMeta | undefined>();
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequestEvent | undefined>();
  const [subagent, setSubagent] = useState<{ label: string; index: number; total: number; tokens: number; cost: number } | undefined>();
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    const unsub = onEvent((event: TuiEvent) => {
      switch (event.type) {
        case "route":
          if (event.route) setRoute(event.route);
          return;
        case "user_input":
          if (event.text) setInput(event.text);
          return;
        case "user_message":
          if (event.text) {
            setRoute("session");
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "user",
                parts: [{ kind: "text", text: event.text }],
                time: Date.now(),
                agent: event.agent ?? agent,
              },
            ]);
            setInput("");
            setRunning(true);
            setStatusText("working...");
            setStartTime(Date.now());
          }
          return;
        case "assistant_start":
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              parts: [],
              time: Date.now(),
              agent: event.agent,
              model: event.model,
              provider: event.provider,
            },
          ]);
          return;
        case "stream":
          if (!event.text) return;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") {
              const newParts = [...last.parts];
              const lastPart = newParts[newParts.length - 1];
              if (lastPart && lastPart.kind === "text") {
                newParts[newParts.length - 1] = {
                  kind: "text",
                  text: (lastPart.text ?? "") + event.text,
                };
              } else {
                newParts.push({ kind: "text", text: event.text });
              }
              return [...prev.slice(0, -1), { ...last, parts: newParts }];
            }
            return [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                parts: [{ kind: "text", text: event.text }],
                time: Date.now(),
              },
            ];
          });
          return;
        case "tool_call":
          if (!event.toolName) return;
          {
            const toolName = event.toolName;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant") {
                const newParts = [
                  ...last.parts,
                  {
                    kind: "tool" as const,
                    tool: classifyTool(toolName),
                    toolName,
                    args: event.args,
                    status: "running" as const,
                  },
                ];
                return [...prev.slice(0, -1), { ...last, parts: newParts }];
              }
              return [
                ...prev,
                {
                  id: nextId(),
                  role: "assistant",
                  parts: [
                    {
                      kind: "tool",
                      tool: classifyTool(toolName),
                      toolName,
                      args: event.args,
                      status: "running",
                    },
                  ],
                  time: Date.now(),
                },
              ];
            });
          }
          return;
        case "tool_result":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const newParts = last.parts.map((p) =>
              p.kind === "tool" && p.status === "running" && p.toolName === event.toolName
                ? {
                    ...p,
                    result: event.result,
                    status: (event.result?.toLowerCase().includes("error") ? "error" : "done") as "error" | "done",
                  }
                : p,
            );
            return [...prev.slice(0, -1), { ...last, parts: newParts }];
          });
          return;
        case "done":
          setRunning(false);
          setStatusText("");
          if (event.tokensIn !== undefined || event.tokensOut !== undefined) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== "assistant") return prev;
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  tokensIn: event.tokensIn,
                  tokensOut: event.tokensOut,
                },
              ];
            });
          }
          return;
        case "error":
          if (event.text) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "error",
                parts: [{ kind: "text", text: event.text }],
                time: Date.now(),
              },
            ]);
          }
          setRunning(false);
          setStatusText("error");
          return;
        case "status":
          if (event.text) setStatusText(event.text);
          return;
        case "session_meta":
          if (event.meta) setMeta(event.meta);
          return;
        case "tokens":
          if (event.tokensIn !== undefined || event.tokensOut !== undefined) {
            setMeta((prev) =>
              prev
                ? {
                    ...prev,
                    tokensIn: event.tokensIn ?? prev.tokensIn,
                    tokensOut: event.tokensOut ?? prev.tokensOut,
                  }
                : prev,
            );
          }
          return;
        case "permission_request":
          if (event.permission) setPermissionRequest(event.permission);
          return;
        case "permission_resolved":
          setPermissionRequest(undefined);
          return;
        case "subagent_session":
          setSubagent({
            label: event.subagentLabel ?? "Subagent",
            index: event.subagentIndex ?? 0,
            total: event.subagentTotal ?? 0,
            tokens: 0,
            cost: 0,
          });
          return;
      }
    });
    return unsub;
  }, [agent]);

  const showSidebar = cols > 120;

  const handleSubmit = (value: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "user",
        parts: [{ kind: "text", text: value }],
        time: Date.now(),
        agent,
      },
    ]);
    setInput("");
    setRunning(true);
    setStatusText("working...");
    setRoute("session");
    setStartTime(Date.now());
  };

  if (route === "home") {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <HomeScreen
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          agent={agent}
          model={model}
          provider={provider}
          workdir={workdir}
          branch={branch}
          version={version}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <SessionScreen
        messages={messages}
        meta={meta}
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        running={running}
        statusText={statusText}
        agent={agent}
        model={model}
        provider={provider}
        workdir={workdir}
        branch={branch}
        showSidebar={showSidebar}
        version={version}
        permissionRequest={permissionRequest}
        subagent={subagent}
        startTime={startTime}
      />
    </Box>
  );
}

export default App;
