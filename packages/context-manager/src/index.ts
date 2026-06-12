import type {
  ContextMessage,
  ContextManagerOpts,
  ContextSnapshot,
  ContextStats,
  CompressionResult,
  BtwResult,
  BtwOpts,
} from "./types.js";
import { DEFAULT_MEMORY_QUERY_K } from "./types.js";
import { TokenBudget } from "./budget.js";
import { applyExtractiveCompression, applySlidingWindow } from "./extract.js";
import { shouldCompress } from "./triggers.js";
import { estimateMessageList, estimateTokens, partitionByRole } from "./util.js";
import { Summarizer, BtwChannel } from "./llm.js";

export class ContextManager {
  private readonly budget: TokenBudget;
  private readonly opts: ContextManagerOpts;
  private turnCount = 0;
  private totalCostUsd = 0;
  private compressionLog: CompressionResult[] = [];

  constructor(opts: ContextManagerOpts) {
    this.opts = opts;
    this.budget = new TokenBudget(opts.budget);
  }

  getStats(): ContextStats {
    const triggered = this.compressionLog[this.compressionLog.length - 1];
    return {
      totalTokens: this.budget.getTotal(),
      messageCount: this.turnCount,
      budgetUsed: this.budget.getBudgetUsed(),
      state: this.budget.getState(),
      triggeredReasons: triggered && triggered.compressed ? [triggered.reason ?? "unknown"] : [],
      turnCount: this.turnCount,
      totalCostUsd: this.totalCostUsd,
    };
  }

  recordUsage(usage: { tokens: number; costUsd?: number }): void {
    this.budget.record(usage.tokens);
    if (usage.costUsd !== undefined) this.totalCostUsd += usage.costUsd;
    this.turnCount++;
  }

  async assemble(
    messages: ContextMessage[],
    opts: { role?: string; goal?: string } = {},
  ): Promise<ContextSnapshot> {
    const { system, nonSystem } = partitionByRole(messages);
    const { memoryContext, codebaseContext } = await this.injectContext(opts.goal ?? "");

    const allMessages: ContextMessage[] = [...system, ...memoryContext, ...codebaseContext, ...nonSystem];

    const trimmed = applySlidingWindow(allMessages, this.opts.budget.maxTokens, this.opts.charsPerToken ?? 4);

    return {
      messages: trimmed,
      stats: this.getStats(),
      memoryContext,
      codebaseContext,
    };
  }

  async maybeCompress(messages: ContextMessage[], force = false): Promise<CompressionResult> {
    const stats = this.getStats();
    const decision = shouldCompress(
      this.opts.triggers,
      { soft: this.opts.budget.softWarnThreshold, hard: this.opts.budget.hardTriggerThreshold },
      {
        budgetUsed: stats.budgetUsed,
        state: stats.state,
        turnCount: this.turnCount,
        costUsd: this.totalCostUsd,
        forced: force,
      },
    );

    if (!decision.shouldCompress) {
      const noop: CompressionResult = {
        compressed: false,
        reason: null,
        beforeTokens: stats.totalTokens,
        afterTokens: stats.totalTokens,
        droppedToolResults: 0,
        droppedMessages: 0,
        summarized: false,
      };
      return noop;
    }

    const before = estimateMessageList(messages, this.opts.charsPerToken ?? 4);

    const result = applyExtractiveCompression(
      messages,
      this.opts.compression,
      this.opts.budget.maxTokens,
      this.opts.charsPerToken ?? 4,
    );

    let afterMessages: ContextMessage[] = result.messages;
    let summarized = false;

    const afterExtract = estimateMessageList(afterMessages, this.opts.charsPerToken ?? 4);

    if (
      this.opts.compression.strategy !== "extractive" &&
      this.opts.provider !== undefined &&
      afterExtract > this.opts.budget.maxTokens
    ) {
      const { system, nonSystem } = partitionByRole(afterMessages);
      if (nonSystem.length > 0) {
        const summarizer = new Summarizer(this.opts.provider, this.opts.model ?? "");
        try {
          const summary = await summarizer.summarize(nonSystem, { signal: this.opts.signal });
          afterMessages = [...system, summary];
          summarized = true;
        } catch {
          // LLM summarize failed; fall back to extractive result
        }
      }
    }

    const after = estimateMessageList(afterMessages, this.opts.charsPerToken ?? 4);
    this.budget.record(after - before);

    const compressionResult: CompressionResult = {
      compressed: true,
      reason: decision.reason,
      beforeTokens: before,
      afterTokens: after,
      droppedToolResults: result.droppedToolResults,
      droppedMessages: result.droppedMessages,
      summarized,
    };
    this.compressionLog.push(compressionResult);
    return compressionResult;
  }

  getCompressedMessages(): ContextMessage[] {
    return [];
  }

  async runBtw(question: string, opts: BtwOpts = {}): Promise<BtwResult> {
    if (this.opts.provider === undefined) {
      throw new Error("ContextManager: provider not configured; cannot runBtw");
    }
    const btw = new BtwChannel(this.opts.provider, this.opts.model ?? "");
    return btw.ask(question, opts);
  }

  getCompressionLog(): ReadonlyArray<CompressionResult> {
    return this.compressionLog;
  }

  reset(): void {
    this.budget.reset();
    this.turnCount = 0;
    this.totalCostUsd = 0;
    this.compressionLog = [];
  }

  private async injectContext(goal: string): Promise<{ memoryContext: ContextMessage[]; codebaseContext: ContextMessage[] }> {
    if (!this.opts.memoryStore || !goal) {
      return { memoryContext: [], codebaseContext: [] };
    }
    const k = this.opts.memoryQueryK ?? DEFAULT_MEMORY_QUERY_K;
    let memoryContext: ContextMessage[] = [];
    let codebaseContext: ContextMessage[] = [];
    try {
      const memoryResults = await this.opts.memoryStore.query(goal, { k });
      memoryContext = memoryResults.map((r) => ({
        role: "system" as const,
        content: `[memory:${r.chunk.source}] ${r.chunk.text}`,
        isCacheBreakpoint: false,
        synthetic: true,
      }));
      const codeResults = await this.opts.memoryStore.query(goal, { k, filterRole: "code-symbol" });
      codebaseContext = codeResults.map((r) => ({
        role: "system" as const,
        content: `[code:${r.chunk.source}] ${r.chunk.text}`,
        isCacheBreakpoint: false,
        synthetic: true,
      }));
    } catch {
      // memory query failed; inject nothing
    }
    return { memoryContext, codebaseContext };
  }
}

export { TokenBudget } from "./budget.js";
export { applyExtractiveCompression, applySlidingWindow } from "./extract.js";
export { shouldCompress } from "./triggers.js";
export { Summarizer, BtwChannel } from "./llm.js";
export { estimateTokens, estimateMessageList, partitionByRole, summarizeContent, emptyMessage } from "./util.js";
export type {
  ContextMessage,
  MessageRole,
  CompressionStrategy,
  ContextState,
  TokenBudgetConfig,
  CompressionConfig,
  AdaptiveTriggerConfig,
  ContextManagerOpts,
  ContextStats,
  ContextSnapshot,
  CompressionResult,
  BtwOpts,
  BtwResult,
} from "./types.js";
export {
  DEFAULT_COMPRESSION,
  DEFAULT_TRIGGERS,
  DEFAULT_MEMORY_QUERY_K,
  DEFAULT_CHARS_PER_TOKEN,
} from "./types.js";
