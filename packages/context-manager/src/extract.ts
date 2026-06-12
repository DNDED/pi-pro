import type { ContextMessage, CompressionConfig } from "./types.js";
import { estimateMessageList, estimateTokens, partitionByRole, isCacheBreakpoint } from "./util.js";

export interface EvictionResult {
  messages: ContextMessage[];
  droppedToolResults: number;
  droppedMessages: number;
}

export function applyExtractiveCompression(
  messages: ContextMessage[],
  config: CompressionConfig,
  maxTokens: number,
  charsPerToken: number,
): EvictionResult {
  const { system, nonSystem } = partitionByRole(messages);
  const toolResults = nonSystem.filter((m) => m.role === "tool");
  const nonToolResults = nonSystem.filter((m) => m.role !== "tool");
  const breakpoints = nonSystem.filter(isCacheBreakpoint);

  const dropToolCount = Math.floor((toolResults.length * config.dropToolResultsPercent) / 100);
  const keptToolResults = toolResults.slice(dropToolCount);

  const preservable = new Set<string>();
  for (const m of breakpoints) preservable.add(messageKey(m));
  for (const m of nonToolResults.slice(-config.preserveLastN)) preservable.add(messageKey(m));

  const protected_ = nonToolResults.filter((m) => preservable.has(messageKey(m)));
  const evictable = nonToolResults.filter((m) => !preservable.has(messageKey(m)));

  const dropMsgCount = Math.floor((evictable.length * config.dropMessagesPercent) / 100);
  const keptEvictable = evictable.slice(dropMsgCount);

  const recombine = [...keptToolResults, ...keptEvictable, ...protected_];

  recombine.sort((a, b) => orderKey(a, messages) - orderKey(b, messages));

  const finalMessages = [...system, ...recombine];

  const tokens = estimateMessageList(finalMessages, charsPerToken);
  if (tokens > maxTokens) {
    return {
      messages: aggressiveTrim(finalMessages, maxTokens, charsPerToken),
      droppedToolResults: dropToolCount,
      droppedMessages: dropMsgCount,
    };
  }

  return {
    messages: finalMessages,
    droppedToolResults: dropToolCount,
    droppedMessages: dropMsgCount,
  };
}

function aggressiveTrim(messages: ContextMessage[], maxTokens: number, charsPerToken: number): ContextMessage[] {
  const { system, nonSystem } = partitionByRole(messages);
  const systemTokens = estimateMessageList(system, charsPerToken);
  const remaining = Math.max(0, maxTokens - systemTokens);
  const result: ContextMessage[] = [...system];
  let used = systemTokens;
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const t = estimateTokens(nonSystem[i], charsPerToken);
    if (used + t > remaining) break;
    result.splice(system.length, 0, nonSystem[i]);
    used += t;
  }
  return result;
}

export function applySlidingWindow(
  messages: ContextMessage[],
  maxTokens: number,
  charsPerToken: number,
): ContextMessage[] {
  const total = estimateMessageList(messages, charsPerToken);
  if (total <= maxTokens) return messages;
  const { system, nonSystem } = partitionByRole(messages);
  const systemTokens = estimateMessageList(system, charsPerToken);
  const budget = Math.max(0, maxTokens - systemTokens);
  const result: ContextMessage[] = [...system];
  let used = 0;
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const t = estimateTokens(nonSystem[i], charsPerToken);
    if (used + t > budget) break;
    result.splice(system.length, 0, nonSystem[i]);
    used += t;
  }
  return result;
}

function messageKey(m: ContextMessage): string {
  return `${m.role}|${m.content}|${m.tool_call_id ?? ""}|${m.name ?? ""}`;
}

function orderKey(m: ContextMessage, all: ContextMessage[]): number {
  return all.indexOf(m);
}
