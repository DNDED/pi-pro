import { describe, it, expect } from "vitest";
import {
  CONTEXT_FLAG_CONFIGS,
  runContextAttribution,
  formatContextAttribution,
  type ContextAttributionRow,
  type ContextAttributionReport,
} from "../src/context-attribution.js";
import type { Provider, Message, CallOpts, StreamChunk, Usage } from "@pi/provider";

class MockProvider implements Provider {
  readonly name = "mock";
  private readonly responses: Array<{ tokensIn: number; tokensOut: number; text: string }>;
  private idx = 0;
  calls = 0;

  constructor(responses: Array<{ tokensIn: number; tokensOut: number; text: string }> = [
    { tokensIn: 100, tokensOut: 50, text: '{"status":"pass","evidence":"done"}' },
  ]) {
    this.responses = responses;
  }

  async *complete(messages: Message[], opts: CallOpts): AsyncIterable<StreamChunk> {
    this.calls++;
    const r = this.responses[Math.min(this.idx, this.responses.length - 1)];
    this.idx++;
    yield { type: "token", text: r.text };
    const usage: Usage = { in: r.tokensIn, out: r.tokensOut, costUsd: 0.001 };
    yield { type: "done", usage };
  }
}

function mkReport(over: Partial<ContextAttributionReport> = {}): ContextAttributionReport {
  const rows: ContextAttributionRow[] = [
    {
      flagLabel: "baseline", description: "all defaults",
      totalCostUsd: 0.018, avgWallMs: 22_000,
      passRate: 0.95, passCount: 5, totalCount: 5,
      compressionEvents: 3, memoryChunksInjected: 18, peakContextUsage: 0.88,
      crossSessionRecall: 0.85, codebaseAccuracy: 0.74,
    },
    {
      flagLabel: "memory-off", description: "no memory",
      totalCostUsd: 0.014, avgWallMs: 20_000,
      passRate: 0.78, passCount: 4, totalCount: 5,
      compressionEvents: 5, memoryChunksInjected: 0, peakContextUsage: 0.92,
      crossSessionRecall: 0.0, codebaseAccuracy: 0.74,
    },
  ];
  const deltas = [
    { flagLabel: "baseline", costDelta: 0, costDeltaPct: 0, wallDelta: 0, passRateDelta: 0, recallDelta: 0, accuracyDelta: 0 },
    { flagLabel: "memory-off", costDelta: -0.004, costDeltaPct: -22.2, wallDelta: -2000, passRateDelta: -0.17, recallDelta: -0.85, accuracyDelta: 0 },
  ];
  return { rows, deltas, ...over };
}

describe("CONTEXT_FLAG_CONFIGS (v0.7.0)", () => {
  it("has baseline with all defaults (empty partial)", () => {
    expect(CONTEXT_FLAG_CONFIGS["baseline"].contextFlags).toEqual({});
  });

  it("memory-off disables memory", () => {
    expect(CONTEXT_FLAG_CONFIGS["memory-off"].contextFlags.memory).toBe(false);
  });

  it("compression-off disables compression", () => {
    expect(CONTEXT_FLAG_CONFIGS["compression-off"].contextFlags.compression).toBe("off");
  });

  it("embeddings-off uses null embeddings", () => {
    expect(CONTEXT_FLAG_CONFIGS["embeddings-off"].contextFlags.embeddings).toBe("null");
  });

  it("all configs have label + description", () => {
    for (const cfg of Object.values(CONTEXT_FLAG_CONFIGS)) {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.description.length).toBeGreaterThan(0);
    }
  });
});

describe("runContextAttribution", () => {
  it("returns 4 rows by default", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    expect(report.rows).toHaveLength(4);
  });

  it("first row is baseline", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    expect(report.rows[0]?.flagLabel).toBe("baseline");
  });

  it("respects configs argument", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] }, ["baseline", "memory-off"]);
    expect(report.rows).toHaveLength(2);
  });

  it("includes all v0.7.0 metrics in rows", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    for (const row of report.rows) {
      expect(row).toHaveProperty("totalCostUsd");
      expect(row).toHaveProperty("avgWallMs");
      expect(row).toHaveProperty("passRate");
      expect(row).toHaveProperty("compressionEvents");
      expect(row).toHaveProperty("memoryChunksInjected");
      expect(row).toHaveProperty("peakContextUsage");
      expect(row).toHaveProperty("crossSessionRecall");
      expect(row).toHaveProperty("codebaseAccuracy");
    }
  });

  it("baseline is the all-on / all-default config", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    const base = report.rows[0]!;
    expect(base.compressionEvents).toBeGreaterThan(0);
    expect(base.memoryChunksInjected).toBeGreaterThan(0);
    expect(base.crossSessionRecall).toBeGreaterThanOrEqual(0.8);
    expect(base.codebaseAccuracy).toBeGreaterThanOrEqual(0.7);
  });

  it("memory-off has 0 memory chunks injected", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    const memOff = report.rows.find(r => r.flagLabel === "memory-off")!;
    expect(memOff.memoryChunksInjected).toBe(0);
    expect(memOff.crossSessionRecall).toBe(0);
  });

  it("compression-off has 0 compression events and peak ≥ 1.0", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    const compOff = report.rows.find(r => r.flagLabel === "compression-off")!;
    expect(compOff.compressionEvents).toBe(0);
    expect(compOff.peakContextUsage).toBeGreaterThanOrEqual(1.0);
  });

  it("embeddings-off has lower recall and accuracy than baseline", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    const base = report.rows[0]!;
    const embOff = report.rows.find(r => r.flagLabel === "embeddings-off")!;
    expect(embOff.crossSessionRecall).toBeLessThan(base.crossSessionRecall);
    expect(embOff.codebaseAccuracy).toBeLessThan(base.codebaseAccuracy);
  });

  it("computes deltas vs baseline", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    const baseDelta = report.deltas[0]!;
    expect(baseDelta.costDelta).toBe(0);
    expect(baseDelta.costDeltaPct).toBe(0);
    expect(baseDelta.passRateDelta).toBe(0);
    expect(baseDelta.recallDelta).toBe(0);
    expect(baseDelta.accuracyDelta).toBe(0);
  });

  it("non-baseline rows have non-zero recall delta when they differ", async () => {
    const provider = new MockProvider();
    const report = await runContextAttribution(provider, { tasks: [] });
    const memOffDelta = report.deltas.find(d => d.flagLabel === "memory-off")!;
    expect(memOffDelta.recallDelta).toBeLessThan(0);
  });
});

describe("formatContextAttribution", () => {
  it("formats as markdown table with v0.7.0 metrics", () => {
    const out = formatContextAttribution(mkReport());
    expect(out).toContain("v0.7.0 Memory at Scale");
    expect(out).toContain("| config       | cost    | wall/avg | pass | recall | codeAcc | peak |");
    expect(out).toContain("baseline");
    expect(out).toContain("memory-off");
    expect(out).toContain("85%");
    expect(out).toContain("74%");
  });

  it("includes deltas section", () => {
    const out = formatContextAttribution(mkReport());
    expect(out).toContain("Delta vs baseline");
    expect(out).toContain("-22.2%");
  });

  it("includes v0.7.0 spec targets", () => {
    const out = formatContextAttribution(mkReport());
    expect(out).toContain("long-session completion");
    expect(out).toContain("cross-session recall");
    expect(out).toContain("codebase search accuracy");
  });

  it("notes live LLM bench deferred", () => {
    const out = formatContextAttribution(mkReport());
    expect(out).toContain("Live LLM bench deferred");
  });
});

describe("v0.7.0 bench — long-task fixture", () => {
  it("long-task-50turn is in the bench task list", async () => {
    const { TASKS } = await import("../tasks/index.js");
    const longTask = TASKS.find(t => t.id === "long-task-50turn");
    expect(longTask).toBeDefined();
    expect(longTask?.difficulty).toBe("very-hard");
  });

  it("long-task description mentions v0.7.0 + cross-session recall + memory leak", async () => {
    const { TASKS } = await import("../tasks/index.js");
    const longTask = TASKS.find(t => t.id === "long-task-50turn");
    expect(longTask?.description).toContain("50+ turn");
    expect(longTask?.description).toContain("context manager");
    expect(longTask?.description).toContain("sliding window");
    expect(longTask?.description).toContain("extractive compression");
    expect(longTask?.description).toContain("cross-session recall");
    expect(longTask?.description).toContain("50MB");
  });

  it("long-task expects /metrics endpoint + tests pass", async () => {
    const { TASKS } = await import("../tasks/index.js");
    const longTask = TASKS.find(t => t.id === "long-task-50turn");
    expect(longTask?.expected.hasNewEndpoint).toBe("/metrics");
    expect(longTask?.expected.testsPass).toBe(true);
  });
});

describe("v0.7.0 — back-compat with v0.5.0 attribution", () => {
  it("v0.5.0 FLAG_CONFIGS still works", async () => {
    const { FLAG_CONFIGS } = await import("../src/attribution.js");
    expect(FLAG_CONFIGS["all-on"].flags.cache).toBe(true);
    expect(FLAG_CONFIGS["all-off"].flags.cache).toBe(false);
  });
});
