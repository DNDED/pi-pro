import type { ContextMessage, MessageRole } from "./types.js";
import { DEFAULT_CHARS_PER_TOKEN } from "./types.js";

export function estimateTokens(message: ContextMessage, charsPerToken: number = DEFAULT_CHARS_PER_TOKEN): number {
  if (message.tokenEstimate !== undefined) return message.tokenEstimate;
  if (message.content.length === 0) return 0;
  return Math.ceil(message.content.length / charsPerToken);
}

export function estimateMessageList(messages: ContextMessage[], charsPerToken?: number): number {
  let total = 0;
  for (const m of messages) total += estimateTokens(m, charsPerToken);
  return total;
}

export function isSystemMessage(m: ContextMessage): boolean {
  return m.role === "system";
}

export function isToolResultMessage(m: ContextMessage): boolean {
  if (m.role !== "tool") return true;
  return false;
}

export function isNonSystemMessage(m: ContextMessage): boolean {
  return m.role !== "system";
}

export function partitionByRole(
  messages: ContextMessage[],
): { system: ContextMessage[]; nonSystem: ContextMessage[] } {
  const system: ContextMessage[] = [];
  const nonSystem: ContextMessage[] = [];
  for (const m of messages) {
    if (isSystemMessage(m)) system.push(m);
    else nonSystem.push(m);
  }
  return { system, nonSystem };
}

export function isCacheBreakpoint(m: ContextMessage): boolean {
  return m.isCacheBreakpoint === true;
}

export function summarizeContent(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.7));
  const tail = text.slice(text.length - Math.floor(maxChars * 0.3));
  return head + "\n...\n" + tail;
}

export function emptyMessage(role: MessageRole, content: string): ContextMessage {
  return { role, content };
}
