export type Role = "system" | "user" | "assistant" | "tool";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: Role;
  content: string | ContentBlock[];
  tool_call_id?: string;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CallOpts {
  model: string;
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
  signal?: AbortSignal;
  apiKey?: string;
  baseUrl?: string;
}

export type StreamChunk =
  | { type: "token"; text: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "done"; usage: { in: number; out: number } };

export function isTokenChunk(c: StreamChunk): c is { type: "token"; text: string } {
  return c.type === "token";
}

export function isToolCallChunk(c: StreamChunk): c is { type: "tool_call"; id: string; name: string; args: unknown } {
  return c.type === "tool_call";
}

export function isDoneChunk(c: StreamChunk): c is { type: "done"; usage: { in: number; out: number } } {
  return c.type === "done";
}

export interface Provider {
  name: string;
  complete(messages: Message[], opts: CallOpts): AsyncIterable<StreamChunk>;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
}
