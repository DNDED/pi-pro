import { describe, it, expect, beforeEach } from "vitest";
import {
  ContextManager,
  TokenBudget,
  applyExtractiveCompression,
  applySlidingWindow,
  shouldCompress,
  estimateTokens,
  estimateMessageList,
  partitionByRole,
  summarizeContent,
  emptyMessage,
  type ContextMessage,
} from "../src/index.js";
import type { Provider, Message, CallOpts, StreamChunk } from "@pi/provider";
import { NullEmbeddings, type EmbeddingsProvider } from "@pi/embeddings";
import { MemoryStore } from "@pi/memory-store";

class FakeProvider implements Provider {
  readonly name = "fake";
  private readonly responses: string[];
  private calls = 0;
  tokensIn = 0;
  tokensOut = 0;

  constructor(responses: string[] = ["FAKE_SUMMARY"]) {
    this.responses = responses;
  }

  async *complete(messages: Message[], opts: CallOpts): AsyncIterable<StreamChunk> {
    this.calls++;
    this.tokensIn += messages.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length / 4 : 50), 0);
    const text = this.responses[this.calls - 1] ?? "FAKE";
    this.tokensOut += text.length / 4;
    yield { type: "token", text };
    yield {
      type: "done",
      usage: { in: Math.ceil(this.tokensIn), out: Math.ceil(this.tokensOut) },
    };
  }

  get callCount(): number {
    return this.calls;
  }
}

class FakeEmbeddings implements EmbeddingsProvider {
  readonly name = "fake";
  readonly dim = 4;
  embed(text: string): Promise<Float32Array> {
    return Promise.resolve(this.embedSync(text));
  }
  embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.resolve(texts.map((t) => this.embedSync(t)));
  }
  private embedSync(text: string): Float32Array {
    const v = new Float32Array(this.dim);
    const t = text.toLowerCase();
    if (t.includes("auth") || t.includes("login")) v[0] = 1;
    if (t.includes("database") || t.includes("db")) v[1] = 1;
    if (t.includes("api")) v[2] = 1;
    if (t.includes("user") || t.includes("account")) v[3] = 1;
    return v;
  }
}

function makeMessages(n: number, opts: { role?: "user" | "assistant" | "tool"; chars?: number } = {}): ContextMessage[] {
  const role = opts.role ?? "user";
  const chars = opts.chars ?? 100;
  return Array.from({ length: n }, (_, i) => ({
    role,
    content: `msg-${i} ` + "x".repeat(chars),
  }));
}

describe("estimateTokens", () => {
  it("estimates from content length with default 4 chars/token", () => {
    expect(estimateTokens({ role: "user", content: "hello world" })).toBe(3);
  });

  it("uses custom charsPerToken", () => {
    expect(estimateTokens({ role: "user", content: "hello world" }, 2)).toBe(6);
  });

  it("returns 0 for empty content", () => {
    expect(estimateTokens({ role: "user", content: "" })).toBe(0);
  });

  it("uses tokenEstimate override when set", () => {
    expect(estimateTokens({ role: "user", content: "x".repeat(100), tokenEstimate: 42 })).toBe(42);
  });
});

describe("estimateMessageList", () => {
  it("sums token estimates across messages", () => {
    const total = estimateMessageList([
      { role: "user", content: "x".repeat(40) },
      { role: "user", content: "x".repeat(40) },
    ]);
    expect(total).toBe(20);
  });
});

describe("partitionByRole", () => {
  it("separates system and non-system", () => {
    const msgs: ContextMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "system", content: "sys2" },
    ];
    const { system, nonSystem } = partitionByRole(msgs);
    expect(system).toHaveLength(2);
    expect(nonSystem).toHaveLength(2);
  });
});

describe("summarizeContent", () => {
  it("returns text unchanged when under maxChars", () => {
    expect(summarizeContent("hello", 100)).toBe("hello");
  });

  it("truncates head+tail when over maxChars", () => {
    const long = "x".repeat(1000);
    const out = summarizeContent(long, 100);
    expect(out.length).toBeLessThan(200);
    expect(out).toContain("...");
  });
});

describe("emptyMessage", () => {
  it("creates a message with role and content", () => {
    expect(emptyMessage("user", "hi")).toEqual({ role: "user", content: "hi" });
  });
});

describe("TokenBudget", () => {
  it("starts at 0 with state 'ok'", () => {
    const b = new TokenBudget({ maxTokens: 1000, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    expect(b.getTotal()).toBe(0);
    expect(b.getState()).toBe("ok");
    expect(b.getBudgetUsed()).toBe(0);
  });

  it("records tokens and updates state", () => {
    const b = new TokenBudget({ maxTokens: 100, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    b.record(50);
    expect(b.getTotal()).toBe(50);
    expect(b.getBudgetUsed()).toBeCloseTo(0.5, 5);
    expect(b.getState()).toBe("ok");
  });

  it("transitions to soft-warn at threshold", () => {
    const b = new TokenBudget({ maxTokens: 100, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    b.record(80);
    expect(b.getState()).toBe("soft-warn");
  });

  it("transitions to hard-trigger at threshold", () => {
    const b = new TokenBudget({ maxTokens: 100, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    b.record(95);
    expect(b.getState()).toBe("hard-trigger");
  });

  it("ignores negative values", () => {
    const b = new TokenBudget({ maxTokens: 100, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    b.record(-50);
    expect(b.getTotal()).toBe(0);
  });

  it("resets to 0", () => {
    const b = new TokenBudget({ maxTokens: 100, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    b.record(50);
    b.reset();
    expect(b.getTotal()).toBe(0);
  });

  it("remaining() returns max - total", () => {
    const b = new TokenBudget({ maxTokens: 100, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    b.record(30);
    expect(b.remaining()).toBe(70);
    b.record(80);
    expect(b.remaining()).toBe(0);
  });

  it("returns 0 budget used when maxTokens is 0", () => {
    const b = new TokenBudget({ maxTokens: 0, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 });
    expect(b.getBudgetUsed()).toBe(0);
  });
});

describe("applySlidingWindow", () => {
  it("returns messages unchanged when under budget", () => {
    const msgs = makeMessages(5, { chars: 40 });
    const out = applySlidingWindow(msgs, 1000, 4);
    expect(out).toHaveLength(5);
  });

  it("evicts oldest non-system messages when over budget", () => {
    const msgs: ContextMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "x".repeat(100) },
      { role: "assistant", content: "x".repeat(100) },
      { role: "user", content: "x".repeat(100) },
      { role: "assistant", content: "x".repeat(100) },
    ];
    const out = applySlidingWindow(msgs, 50, 4);
    expect(out[0].role).toBe("system");
    expect(out.length).toBeLessThan(msgs.length);
  });

  it("preserves all system messages", () => {
    const msgs: ContextMessage[] = [
      { role: "system", content: "x".repeat(100) },
      { role: "system", content: "y".repeat(100) },
      { role: "user", content: "x".repeat(100) },
    ];
    const out = applySlidingWindow(msgs, 30, 4);
    expect(out.filter((m) => m.role === "system")).toHaveLength(2);
  });
});

describe("applyExtractiveCompression", () => {
  it("drops oldest tool results first", () => {
    const msgs: ContextMessage[] = [
      { role: "user", content: "u" },
      { role: "tool", content: "tr1" },
      { role: "tool", content: "tr2" },
      { role: "tool", content: "tr3" },
      { role: "tool", content: "tr4" },
    ];
    const out = applyExtractiveCompression(
      msgs,
      { strategy: "extractive", dropToolResultsPercent: 50, dropMessagesPercent: 0, preserveLastN: 2, maxSummaryTokens: 500 },
      1000,
      4,
    );
    expect(out.droppedToolResults).toBe(2);
    expect(out.messages.filter((m) => m.role === "tool")).toHaveLength(2);
  });

  it("preserves system messages", () => {
    const msgs: ContextMessage[] = [
      { role: "system", content: "sys1" },
      { role: "system", content: "sys2" },
      { role: "user", content: "u1" },
      { role: "user", content: "u2" },
    ];
    const out = applyExtractiveCompression(
      msgs,
      { strategy: "extractive", dropToolResultsPercent: 0, dropMessagesPercent: 50, preserveLastN: 1, maxSummaryTokens: 500 },
      1000,
      4,
    );
    expect(out.messages.filter((m) => m.role === "system")).toHaveLength(2);
  });

  it("preserves last N messages", () => {
    const msgs: ContextMessage[] = makeMessages(10, { role: "user" });
    const out = applyExtractiveCompression(
      msgs,
      { strategy: "extractive", dropToolResultsPercent: 0, dropMessagesPercent: 100, preserveLastN: 3, maxSummaryTokens: 500 },
      1000,
      4,
    );
    const lastThree = msgs.slice(-3);
    const outContents = out.messages.map((m) => m.content);
    for (const m of lastThree) expect(outContents).toContain(m.content);
  });

  it("preserves cache breakpoints", () => {
    const msgs: ContextMessage[] = [
      { role: "user", content: "u1", isCacheBreakpoint: true },
      { role: "user", content: "u2" },
      { role: "user", content: "u3" },
    ];
    const out = applyExtractiveCompression(
      msgs,
      { strategy: "extractive", dropToolResultsPercent: 0, dropMessagesPercent: 50, preserveLastN: 0, maxSummaryTokens: 500 },
      1000,
      4,
    );
    expect(out.messages.map((m) => m.content)).toContain("u1");
  });

  it("trims aggressively when over token budget", () => {
    const msgs: ContextMessage[] = [
      { role: "system", content: "sys" },
      ...makeMessages(20, { chars: 100 }),
    ];
    const out = applyExtractiveCompression(
      msgs,
      { strategy: "extractive", dropToolResultsPercent: 0, dropMessagesPercent: 0, preserveLastN: 0, maxSummaryTokens: 500 },
      100,
      4,
    );
    expect(estimateMessageList(out.messages, 4)).toBeLessThanOrEqual(100);
  });
});

describe("shouldCompress", () => {
  const config = {
    turnInterval: 20,
    costCapUsd: 0.5,
    enableTurnInterval: true,
    enableCostCap: true,
  };
  const thresholds = { soft: 0.75, hard: 0.9 };

  it("returns false when no trigger fires", () => {
    const r = shouldCompress(config, thresholds, {
      budgetUsed: 0.5,
      state: "ok",
      turnCount: 5,
      costUsd: 0.1,
      forced: false,
    });
    expect(r.shouldCompress).toBe(false);
  });

  it("triggers on hard threshold (forced)", () => {
    const r = shouldCompress(config, thresholds, {
      budgetUsed: 0.95,
      state: "hard-trigger",
      turnCount: 5,
      costUsd: 0.1,
      forced: false,
    });
    expect(r.shouldCompress).toBe(true);
    expect(r.reason).toBe("hard-token-threshold");
    expect(r.force).toBe(true);
  });

  it("triggers on turn interval", () => {
    const r = shouldCompress(config, thresholds, {
      budgetUsed: 0.3,
      state: "ok",
      turnCount: 20,
      costUsd: 0.1,
      forced: false,
    });
    expect(r.shouldCompress).toBe(true);
    expect(r.reason).toBe("turn-interval");
  });

  it("triggers on cost cap", () => {
    const r = shouldCompress(config, thresholds, {
      budgetUsed: 0.3,
      state: "ok",
      turnCount: 5,
      costUsd: 0.6,
      forced: false,
    });
    expect(r.shouldCompress).toBe(true);
    expect(r.reason).toBe("cost-cap");
  });

  it("forced flag wins", () => {
    const r = shouldCompress(config, thresholds, {
      budgetUsed: 0.1,
      state: "ok",
      turnCount: 0,
      costUsd: 0,
      forced: true,
    });
    expect(r.shouldCompress).toBe(true);
    expect(r.reason).toBe("forced");
  });

  it("respects disabled turn interval", () => {
    const r = shouldCompress(
      { ...config, enableTurnInterval: false },
      thresholds,
      { budgetUsed: 0.1, state: "ok", turnCount: 20, costUsd: 0, forced: false },
    );
    expect(r.shouldCompress).toBe(false);
  });

  it("respects disabled cost cap", () => {
    const r = shouldCompress(
      { ...config, enableCostCap: false },
      thresholds,
      { budgetUsed: 0.1, state: "ok", turnCount: 0, costUsd: 0.6, forced: false },
    );
    expect(r.shouldCompress).toBe(false);
  });
});

describe("ContextManager — basic", () => {
  const defaultOpts = () => ({
    budget: { maxTokens: 1000, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 },
    compression: { strategy: "extractive" as const, dropToolResultsPercent: 50, dropMessagesPercent: 30, preserveLastN: 4, maxSummaryTokens: 500 },
    triggers: { turnInterval: 20, costCapUsd: 0.5, enableTurnInterval: true, enableCostCap: true },
  });

  it("starts with zero stats", () => {
    const cm = new ContextManager(defaultOpts());
    const stats = cm.getStats();
    expect(stats.totalTokens).toBe(0);
    expect(stats.turnCount).toBe(0);
    expect(stats.state).toBe("ok");
  });

  it("records usage", () => {
    const cm = new ContextManager(defaultOpts());
    cm.recordUsage({ tokens: 100 });
    cm.recordUsage({ tokens: 200, costUsd: 0.01 });
    expect(cm.getStats().totalTokens).toBe(300);
    expect(cm.getStats().totalCostUsd).toBe(0.01);
    expect(cm.getStats().turnCount).toBe(2);
  });

  it("transitions state as tokens accumulate", () => {
    const cm = new ContextManager(defaultOpts());
    cm.recordUsage({ tokens: 800 });
    expect(cm.getStats().state).toBe("soft-warn");
    cm.recordUsage({ tokens: 200 });
    expect(cm.getStats().state).toBe("hard-trigger");
  });

  it("resets stats", () => {
    const cm = new ContextManager(defaultOpts());
    cm.recordUsage({ tokens: 500 });
    cm.reset();
    expect(cm.getStats().totalTokens).toBe(0);
    expect(cm.getStats().turnCount).toBe(0);
  });
});

describe("ContextManager — assemble", () => {
  const defaultOpts = () => ({
    budget: { maxTokens: 1000, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 },
    compression: { strategy: "extractive" as const, dropToolResultsPercent: 50, dropMessagesPercent: 30, preserveLastN: 4, maxSummaryTokens: 500 },
    triggers: { turnInterval: 20, costCapUsd: 0.5, enableTurnInterval: true, enableCostCap: true },
  });

  it("assembles messages with system + user/assistant", async () => {
    const cm = new ContextManager(defaultOpts());
    const messages: ContextMessage[] = [
      { role: "system", content: "you are pi-pro" },
      { role: "user", content: "hello" },
    ];
    const snap = await cm.assemble(messages);
    expect(snap.messages.find((m) => m.role === "system")).toBeDefined();
    expect(snap.messages.find((m) => m.content === "hello")).toBeDefined();
  });

  it("trims messages when over budget", async () => {
    const cm = new ContextManager({ ...defaultOpts(), budget: { maxTokens: 50, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 } });
    const messages: ContextMessage[] = [
      { role: "system", content: "sys" },
      ...makeMessages(20, { chars: 100 }),
    ];
    const snap = await cm.assemble(messages);
    expect(estimateMessageList(snap.messages, 4)).toBeLessThanOrEqual(50);
  });

  it("injects memory context when memoryStore provided", async () => {
    const store = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await store.addChunk({ source: "doc.md", role: "fact", text: "user prefers dark mode", project: "p1" });
    const cm = new ContextManager({ ...defaultOpts(), memoryStore: store });
    const snap = await cm.assemble(
      [
        { role: "system", content: "sys" },
        { role: "user", content: "dark mode" },
      ],
      { goal: "dark mode" },
    );
    expect(snap.memoryContext.length).toBeGreaterThan(0);
  });

  it("does not inject when no goal given", async () => {
    const store = new MemoryStore({ embeddings: new FakeEmbeddings() });
    await store.addChunk({ source: "doc.md", role: "fact", text: "x", project: "p1" });
    const cm = new ContextManager({ ...defaultOpts(), memoryStore: store });
    const snap = await cm.assemble([{ role: "user", content: "hi" }]);
    expect(snap.memoryContext).toHaveLength(0);
  });
});

describe("ContextManager — maybeCompress", () => {
  const defaultOpts = () => ({
    budget: { maxTokens: 100, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 },
    compression: { strategy: "extractive" as const, dropToolResultsPercent: 50, dropMessagesPercent: 30, preserveLastN: 4, maxSummaryTokens: 500 },
    triggers: { turnInterval: 20, costCapUsd: 0.5, enableTurnInterval: true, enableCostCap: true },
  });

  it("does not compress when no trigger fires", async () => {
    const cm = new ContextManager(defaultOpts());
    cm.recordUsage({ tokens: 30 });
    const result = await cm.maybeCompress(makeMessages(5));
    expect(result.compressed).toBe(false);
  });

  it("compresses on hard token threshold", async () => {
    const cm = new ContextManager(defaultOpts());
    cm.recordUsage({ tokens: 95 });
    const result = await cm.maybeCompress(makeMessages(20));
    expect(result.compressed).toBe(true);
    expect(result.reason).toBe("hard-token-threshold");
  });

  it("compresses when forced", async () => {
    const cm = new ContextManager(defaultOpts());
    cm.recordUsage({ tokens: 10 });
    const result = await cm.maybeCompress(makeMessages(20), true);
    expect(result.compressed).toBe(true);
    expect(result.reason).toBe("forced");
  });

  it("logs compression results", async () => {
    const cm = new ContextManager(defaultOpts());
    cm.recordUsage({ tokens: 95 });
    await cm.maybeCompress(makeMessages(20));
    expect(cm.getCompressionLog().length).toBe(1);
  });

  it("falls back to extractive when LLM summarization throws", async () => {
    const provider: Provider = {
      name: "broken",
      async *complete(): AsyncIterable<StreamChunk> {
        throw new Error("LLM down");
      },
    };
    const cm = new ContextManager({
      ...defaultOpts(),
      compression: { ...defaultOpts().compression, strategy: "hybrid" },
      provider,
    });
    cm.recordUsage({ tokens: 95 });
    const result = await cm.maybeCompress(makeMessages(20));
    expect(result.compressed).toBe(true);
    expect(result.summarized).toBe(false);
  });
});

describe("ContextManager — runBtw", () => {
  it("throws when provider not configured", async () => {
    const cm = new ContextManager({
      budget: { maxTokens: 1000, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 },
      compression: { strategy: "extractive", dropToolResultsPercent: 50, dropMessagesPercent: 30, preserveLastN: 4, maxSummaryTokens: 500 },
      triggers: { turnInterval: 20, costCapUsd: 0.5, enableTurnInterval: true, enableCostCap: true },
    });
    await expect(cm.runBtw("hi")).rejects.toThrow(/provider not configured/);
  });

  it("returns answer from LLM without polluting stats", async () => {
    const provider = new FakeProvider(["42"]);
    const cm = new ContextManager({
      budget: { maxTokens: 1000, softWarnThreshold: 0.75, hardTriggerThreshold: 0.9 },
      compression: { strategy: "extractive", dropToolResultsPercent: 50, dropMessagesPercent: 30, preserveLastN: 4, maxSummaryTokens: 500 },
      triggers: { turnInterval: 20, costCapUsd: 0.5, enableTurnInterval: true, enableCostCap: true },
      provider,
      model: "test-model",
    });
    cm.recordUsage({ tokens: 100 });
    const before = cm.getStats();
    const result = await cm.runBtw("What is 6*7?");
    expect(result.answer).toBe("42");
    expect(result.question).toBe("What is 6*7?");
    const after = cm.getStats();
    expect(after.totalTokens).toBe(before.totalTokens);
  });
});
