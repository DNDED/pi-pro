import { describe, it, expect, beforeEach } from "vitest";
import { LlmWorker } from "../src/llm-worker.js";
import type { Provider, Message, CallOpts, StreamChunk, Usage } from "@pi/provider";
import type { ContextManager, ContextStats } from "@pi/context-manager";
import { ToolInstance } from "../src/llm-worker.js";
import { StepContext } from "../src/types.js";

class FakeProvider implements Provider {
  readonly name = "fake";
  private readonly response: { tokensIn: number; tokensOut: number; costUsd?: number; text: string };
  calls: Array<{ messages: Message[]; opts: CallOpts }> = [];
  responseIndex = 0;
  responses: Array<{ tokensIn: number; tokensOut: number; costUsd?: number; text: string }>;

  constructor(responses: Array<{ tokensIn: number; tokensOut: number; costUsd?: number; text: string }> = [
    { tokensIn: 100, tokensOut: 50, text: '{"status":"pass","evidence":"done"}' },
  ]) {
    this.responses = responses;
    this.response = responses[0];
  }

  async *complete(messages: Message[], opts: CallOpts): AsyncIterable<StreamChunk> {
    this.calls.push({ messages, opts });
    const r = this.responses[Math.min(this.responseIndex, this.responses.length - 1)];
    this.responseIndex++;
    yield { type: "token", text: r.text };
    const usage: Usage = { in: r.tokensIn, out: r.tokensOut };
    if (r.costUsd !== undefined) usage.costUsd = r.costUsd;
    yield { type: "done", usage };
  }
}

class FakeContextManager {
  recordUsageCalls: Array<{ tokens: number; costUsd?: number }> = [];
  maybeCompressCalls: number = 0;
  runBtwCalls: Array<{ question: string; result: { question: string; answer: string; tokensUsed: number; costUsd?: number } }> = [];
  getStatsCalls = 0;
  private stats: ContextStats = {
    totalTokens: 0,
    messageCount: 0,
    budgetUsed: 0,
    state: "ok",
    triggeredReasons: [],
    turnCount: 0,
    totalCostUsd: 0,
  };

  recordUsage(usage: { tokens: number; costUsd?: number }): void {
    this.recordUsageCalls.push(usage);
    this.stats.totalTokens += usage.tokens;
    if (usage.costUsd !== undefined) this.stats.totalCostUsd += usage.costUsd;
  }

  async maybeCompress(): Promise<{ compressed: boolean; reason: string | null }> {
    this.maybeCompressCalls++;
    return { compressed: false, reason: null };
  }

  getCompressedMessages(): never[] {
    return [];
  }

  getStats(): ContextStats {
    this.getStatsCalls++;
    return this.stats;
  }

  async runBtw(question: string): Promise<{ question: string; answer: string; tokensUsed: number; costUsd?: number }> {
    const result = { question, answer: "42", tokensUsed: 50, costUsd: 0.001 };
    this.runBtwCalls.push({ question, result });
    return result;
  }
}

function makeTools(): ToolInstance[] {
  return [
    {
      name: "read",
      description: "read file",
      input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      execute: async () => "file contents",
    },
  ];
}

function makeContext(): StepContext {
  return {
    taskId: "tsk_test",
    stepId: "step1",
    description: "test task",
  };
}

describe("LlmWorker — v0.7.0 ContextManager integration", () => {
  it("works without contextManager (back-compat)", async () => {
    const provider = new FakeProvider();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model" });
    const result = await worker.run("build", makeContext());
    expect(result.status).toBe("pass");
    expect(worker.getContextStats()).toBeNull();
  });

  it("records usage in contextManager after LLM call", async () => {
    const provider = new FakeProvider([{ tokensIn: 200, tokensOut: 100, costUsd: 0.005, text: '{"status":"pass","evidence":"x"}' }]);
    const cm = new FakeContextManager();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model", contextManager: cm as unknown as ContextManager });
    await worker.run("build", makeContext());
    expect(cm.recordUsageCalls).toHaveLength(1);
    expect(cm.recordUsageCalls[0].tokens).toBe(300);
    expect(cm.recordUsageCalls[0].costUsd).toBe(0.005);
  });

  it("calls maybeCompress at the start of run()", async () => {
    const provider = new FakeProvider();
    const cm = new FakeContextManager();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model", contextManager: cm as unknown as ContextManager });
    await worker.run("build", makeContext());
    expect(cm.maybeCompressCalls).toBe(1);
  });

  it("getContextStats returns stats from contextManager", async () => {
    const provider = new FakeProvider([{ tokensIn: 100, tokensOut: 50, costUsd: 0.01, text: '{"status":"pass","evidence":"x"}' }]);
    const cm = new FakeContextManager();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model", contextManager: cm as unknown as ContextManager });
    await worker.run("build", makeContext());
    const stats = worker.getContextStats();
    expect(stats).not.toBeNull();
    expect(stats!.totalTokens).toBe(150);
    expect(stats!.totalCostUsd).toBe(0.01);
  });

  it("runBtw delegates to contextManager", async () => {
    const provider = new FakeProvider();
    const cm = new FakeContextManager();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model", contextManager: cm as unknown as ContextManager });
    const result = await worker.runBtw("What is 6*7?");
    expect(result.answer).toBe("42");
    expect(cm.runBtwCalls).toHaveLength(1);
  });

  it("runBtw throws when no contextManager configured", async () => {
    const provider = new FakeProvider();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model" });
    await expect(worker.runBtw("hi")).rejects.toThrow(/contextManager not configured/);
  });

  it("records multiple usage calls across iterations", async () => {
    const longThinking = "<thinking>" + "x".repeat(2000) + "</thinking>";
    const provider = new FakeProvider([
      { tokensIn: 100, tokensOut: 50, text: longThinking },
      { tokensIn: 80, tokensOut: 30, text: '{"status":"pass","evidence":"done"}' },
    ]);
    const cm = new FakeContextManager();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model", contextManager: cm as unknown as ContextManager, maxIterations: 5 });
    await worker.run("build", makeContext());
    expect(cm.recordUsageCalls.length).toBeGreaterThanOrEqual(2);
    const totalTokens = cm.recordUsageCalls.reduce((s, u) => s + u.tokens, 0);
    expect(totalTokens).toBe(100 + 80 + 50 + 30);
  });

  it("getLastTurnUsage returns null before any run()", () => {
    const provider = new FakeProvider();
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model" });
    expect(worker.getLastTurnUsage()).toBeNull();
  });

  it("getLastTurnUsage returns the last LLM call's usage after run()", async () => {
    const provider = new FakeProvider([{ tokensIn: 200, tokensOut: 100, costUsd: 0.005, text: '{"status":"pass","evidence":"x"}' }]);
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model" });
    await worker.run("build", makeContext());
    const last = worker.getLastTurnUsage();
    expect(last).not.toBeNull();
    expect(last!.tokensIn).toBe(200);
    expect(last!.tokensOut).toBe(100);
    expect(last!.costUsd).toBe(0.005);
    expect(last!.turnNumber).toBe(1);
    expect(last!.toolCalls).toBe(0);
  });

  it("getLastTurnUsage updates per iteration in multi-turn run()", async () => {
    const provider = new FakeProvider([
      { tokensIn: 100, tokensOut: 50, costUsd: 0.001, text: "<thinking>" + "x".repeat(2000) + "</thinking>" },
      { tokensIn: 80, tokensOut: 30, costUsd: 0.002, text: '{"status":"pass","evidence":"done"}' },
    ]);
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model", maxIterations: 5 });
    await worker.run("build", makeContext());
    const last = worker.getLastTurnUsage();
    expect(last).not.toBeNull();
    expect(last!.tokensIn).toBe(80);
    expect(last!.tokensOut).toBe(30);
    expect(last!.costUsd).toBe(0.002);
    expect(last!.turnNumber).toBe(2);
  });

  it("getDeltaSinceLastRun returns null on first run()", async () => {
    const provider = new FakeProvider([{ tokensIn: 100, tokensOut: 50, text: '{"status":"pass","evidence":"x"}' }]);
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model" });
    expect(worker.getDeltaSinceLastRun()).toBeNull();
    await worker.run("build", makeContext());
    expect(worker.getDeltaSinceLastRun()).toBeNull();
  });

  it("getDeltaSinceLastRun returns delta on second run()", async () => {
    const provider = new FakeProvider([
      { tokensIn: 100, tokensOut: 50, costUsd: 0.001, text: '{"status":"pass","evidence":"first"}' },
      { tokensIn: 200, tokensOut: 100, costUsd: 0.002, text: '{"status":"pass","evidence":"second"}' },
    ]);
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model" });
    await worker.run("build", makeContext());
    await worker.run("build", makeContext());
    const delta = worker.getDeltaSinceLastRun();
    expect(delta).not.toBeNull();
    expect(delta!.tokensIn).toBe(200);
    expect(delta!.tokensOut).toBe(100);
    expect(delta!.costUsd).toBe(0.002);
    expect(delta!.turns).toBe(1);
  });

  it("getDeltaSinceLastRun returns the last run's tokens (not cumulative)", async () => {
    const provider = new FakeProvider([
      { tokensIn: 100, tokensOut: 50, costUsd: 0.001, text: '{"status":"pass","evidence":"r1"}' },
      { tokensIn: 200, tokensOut: 100, costUsd: 0.002, text: '{"status":"pass","evidence":"r2"}' },
      { tokensIn: 300, tokensOut: 150, costUsd: 0.003, text: '{"status":"pass","evidence":"r3"}' },
    ]);
    const worker = new LlmWorker(provider, makeTools(), "/tmp", { model: "fake-model" });
    await worker.run("build", makeContext());
    await worker.run("build", makeContext());
    await worker.run("build", makeContext());
    const delta = worker.getDeltaSinceLastRun();
    expect(delta).not.toBeNull();
    expect(delta!.tokensIn).toBe(300);
    expect(delta!.tokensOut).toBe(150);
    expect(delta!.costUsd).toBe(0.003);
    expect(delta!.turns).toBe(1);
  });
});
