import { EventEmitter } from "node:events";

export type ToolKind = "read" | "write" | "edit" | "bash" | "grep" | "glob" | "webfetch" | "task" | "todo" | "other";

export interface MessagePart {
  kind: "text" | "tool" | "reasoning" | "error";
  text?: string;
  tool?: ToolKind;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: string;
  status?: "running" | "done" | "error";
}

export interface FilePill {
  type: "image" | "pdf" | "file";
  label: string;
  mime?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  parts: MessagePart[];
  time: number;
  agent?: string;
  model?: string;
  provider?: string;
  tokensIn?: number;
  tokensOut?: number;
  files?: FilePill[];
}

export type RouteName = "home" | "session";

export interface SessionMeta {
  id: string;
  title: string;
  agent: string;
  model: string;
  provider: string;
  workdir: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  shareUrl?: string;
  parentId?: string;
  contextLimit?: number;
}

export interface PermissionRequestEvent {
  id: string;
  permission: string;
  tool: string;
  args: Record<string, unknown>;
  title?: string;
  patterns?: string[];
}

export interface TuiEvent {
  type:
    | "route"
    | "user_input"
    | "user_message"
    | "assistant_start"
    | "stream"
    | "tool_call"
    | "tool_result"
    | "done"
    | "error"
    | "status"
    | "session_meta"
    | "tokens"
    | "permission_request"
    | "permission_resolved"
    | "subagent_session";
  route?: RouteName;
  text?: string;
  tool?: ToolKind;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: string;
  tokensIn?: number;
  tokensOut?: number;
  duration?: number;
  meta?: SessionMeta;
  agent?: string;
  model?: string;
  provider?: string;
  permission?: PermissionRequestEvent;
  parentId?: string;
  subagentLabel?: string;
  subagentIndex?: number;
  subagentTotal?: number;
}

export const tuiEvents = new EventEmitter();
tuiEvents.setMaxListeners(50);

export function emit(event: TuiEvent): void {
  tuiEvents.emit("event", event);
}

export function onEvent(callback: (event: TuiEvent) => void): () => void {
  tuiEvents.on("event", callback);
  return () => tuiEvents.off("event", callback);
}

export function classifyTool(name: string): ToolKind {
  const n = name.toLowerCase();
  if (n === "read" || n === "view") return "read";
  if (n === "write" || n === "create") return "write";
  if (n === "edit" || n === "patch" || n === "multiedit") return "edit";
  if (n === "bash" || n === "shell" || n === "exec") return "bash";
  if (n === "grep" || n === "search") return "grep";
  if (n === "glob" || n === "list" || n === "ls") return "glob";
  if (n === "webfetch" || n === "fetch") return "webfetch";
  if (n === "task" || n === "subagent") return "task";
  if (n === "todo" || n === "todowrite") return "todo";
  return "other";
}

export function formatToolArgs(args: Record<string, unknown> | undefined): string {
  if (!args) return "";
  const a = args as Record<string, unknown>;
  if (typeof a.path === "string") return a.path;
  if (typeof a.file_path === "string") return a.file_path;
  if (typeof a.command === "string") return a.command;
  if (typeof a.cmd === "string") return a.cmd;
  if (typeof a.pattern === "string") return a.pattern;
  if (typeof a.query === "string") return a.query;
  if (typeof a.url === "string") return a.url;
  if (typeof a.description === "string") return a.description;
  const first = Object.values(a)[0];
  if (typeof first === "string") return first;
  return JSON.stringify(a).slice(0, 80);
}
