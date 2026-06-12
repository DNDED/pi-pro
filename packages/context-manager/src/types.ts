export type MessageRole = "system" | "user" | "assistant" | "tool";

export type CompressionStrategy = "off" | "extractive" | "llm" | "hybrid";

export type ContextState = "ok" | "soft-warn" | "hard-trigger";

export interface ContextMessage {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  name?: string;
  isCacheBreakpoint?: boolean;
  tokenEstimate?: number;
  synthetic?: boolean;
}

export interface TokenBudgetConfig {
  maxTokens: number;
  softWarnThreshold: number;
  hardTriggerThreshold: number;
}

export interface CompressionConfig {
  strategy: CompressionStrategy;
  dropToolResultsPercent: number;
  dropMessagesPercent: number;
  preserveLastN: number;
  maxSummaryTokens: number;
}

export interface AdaptiveTriggerConfig {
  turnInterval: number;
  costCapUsd: number;
  enableTurnInterval: boolean;
  enableCostCap: boolean;
}

export interface ContextManagerOpts {
  budget: TokenBudgetConfig;
  compression: CompressionConfig;
  triggers: AdaptiveTriggerConfig;
  provider?: import("@pi/provider").Provider;
  model?: string;
  memoryStore?: import("@pi/memory-store").MemoryStore;
  memoryQueryK?: number;
  fetchFn?: typeof fetch;
  charsPerToken?: number;
  signal?: AbortSignal;
}

export interface ContextStats {
  totalTokens: number;
  messageCount: number;
  budgetUsed: number;
  state: ContextState;
  triggeredReasons: string[];
  turnCount: number;
  totalCostUsd: number;
}

export interface ContextSnapshot {
  messages: ContextMessage[];
  stats: ContextStats;
  memoryContext: ContextMessage[];
  codebaseContext: ContextMessage[];
}

export interface CompressionResult {
  compressed: boolean;
  reason: string | null;
  beforeTokens: number;
  afterTokens: number;
  droppedToolResults: number;
  droppedMessages: number;
  summarized: boolean;
}

export interface BtwOpts {
  signal?: AbortSignal;
  context?: ContextMessage[];
}

export interface BtwResult {
  question: string;
  answer: string;
  tokensUsed: number;
  costUsd?: number;
}

export const DEFAULT_COMPRESSION: CompressionConfig = {
  strategy: "hybrid",
  dropToolResultsPercent: 50,
  dropMessagesPercent: 30,
  preserveLastN: 4,
  maxSummaryTokens: 500,
};

export const DEFAULT_TRIGGERS: AdaptiveTriggerConfig = {
  turnInterval: 20,
  costCapUsd: 0.5,
  enableTurnInterval: true,
  enableCostCap: true,
};

export const DEFAULT_MEMORY_QUERY_K = 20;
export const DEFAULT_CHARS_PER_TOKEN = 4;
