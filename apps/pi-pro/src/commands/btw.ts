import { ContextManager } from "@pi/context-manager";
import type { Provider } from "@pi/provider";
import { MemoryStore } from "@pi/memory-store";
import { defaultEmbeddings } from "@pi/embeddings";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { defaultMemoryPath } from "./memory.js";

export interface BtwOpts {
  provider?: Provider;
  model?: string;
  signal?: AbortSignal;
  project?: string;
  compressionStrategy?: "off" | "extractive" | "llm" | "hybrid";
  softWarn?: number;
  hardTrigger?: number;
  memoryK?: number;
}

export async function btw(question: string, opts: BtwOpts = {}): Promise<string> {
  if (!opts.provider) {
    throw new Error("btw: provider is required");
  }
  const memoryPath = defaultMemoryPath();
  mkdirSync(join(memoryPath, ".."), { recursive: true });
  const store = new MemoryStore({ dbPath: memoryPath, embeddings: defaultEmbeddings() });
  const cm = new ContextManager({
    provider: opts.provider,
    model: opts.model ?? "",
    memoryStore: store,
    budget: {
      maxTokens: 200_000,
      softWarnThreshold: opts.softWarn ?? 0.75,
      hardTriggerThreshold: opts.hardTrigger ?? 0.90,
    },
    compression: {
      strategy: opts.compressionStrategy ?? "hybrid",
      dropToolResultsPercent: 50,
      dropMessagesPercent: 30,
      preserveLastN: 4,
      maxSummaryTokens: 500,
    },
    triggers: { turnInterval: 0, costCapUsd: 0, enableTurnInterval: false, enableCostCap: false },
    memoryQueryK: opts.memoryK ?? 5,
    signal: opts.signal,
  });
  try {
    const result = await cm.runBtw(question);
    return result.answer;
  } finally {
    store.close();
  }
}

export interface ContextCmdOpts {
  provider?: Provider;
  model?: string;
  memoryStore?: MemoryStore;
}

export async function contextStats(opts: ContextCmdOpts = {}): Promise<{
  totalTokens: number;
  budgetUsed: number;
  state: string;
  turnCount: number;
  totalCostUsd: number;
  triggeredReasons: string[];
}> {
  if (!opts.memoryStore) {
    const memoryPath = defaultMemoryPath();
    const store = new MemoryStore({ dbPath: memoryPath, embeddings: defaultEmbeddings() });
    try {
      const cm = new ContextManager({
        provider: opts.provider,
        model: opts.model ?? "",
        memoryStore: store,
        budget: { maxTokens: 200_000, softWarnThreshold: 0.75, hardTriggerThreshold: 0.90 },
        compression: { strategy: "hybrid", dropToolResultsPercent: 50, dropMessagesPercent: 30, preserveLastN: 4, maxSummaryTokens: 500 },
        triggers: { turnInterval: 0, costCapUsd: 0, enableTurnInterval: false, enableCostCap: false },
      });
      return cm.getStats();
    } finally {
      store.close();
    }
  }
  const cm = new ContextManager({
    provider: opts.provider,
    model: opts.model ?? "",
    memoryStore: opts.memoryStore,
    budget: { maxTokens: 200_000, softWarnThreshold: 0.75, hardTriggerThreshold: 0.90 },
    compression: { strategy: "hybrid", dropToolResultsPercent: 50, dropMessagesPercent: 30, preserveLastN: 4, maxSummaryTokens: 500 },
    triggers: { turnInterval: 0, costCapUsd: 0, enableTurnInterval: false, enableCostCap: false },
  });
  return cm.getStats();
}

export function formatContextStats(stats: Awaited<ReturnType<typeof contextStats>>): string {
  const pct = (stats.budgetUsed * 100).toFixed(0);
  const stateColor = stats.state === "hard-trigger" ? "!" : stats.state === "soft-warn" ? "?" : " ";
  return [
    `  ctx: ${stats.totalTokens} tok (${pct}%) [${stateColor}${stats.state}]`,
    `  turn: ${stats.turnCount}`,
    `  cost: $${stats.totalCostUsd.toFixed(4)}`,
    stats.triggeredReasons.length > 0 ? `  triggers: ${stats.triggeredReasons.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}
