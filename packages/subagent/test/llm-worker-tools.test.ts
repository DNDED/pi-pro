import { describe, it, expect } from "vitest";
import { LlmWorker, type ToolInstance } from "../src/llm-worker.js";
import { Provider, type StreamChunk } from "@pi/provider";

class FakeProvider implements Provider {
  readonly name = "fake";
  async *complete(): AsyncIterable<StreamChunk> {
    yield { type: "done", usage: { in: 0, out: 0 } };
  }
}

function makeWorker(tools: ToolInstance[]): LlmWorker {
  return new LlmWorker(new FakeProvider(), tools, "/tmp", { maxIterations: 1 });
}

const noopTool: ToolInstance = {
  name: "read",
  description: "no-op",
  input_schema: { type: "object", properties: {} },
  execute: async () => "ok",
};

describe("LlmWorker.setActiveTools", () => {
  it("starts with no active tools (all allowed)", () => {
    const w = makeWorker([noopTool]);
    expect(w.getActiveTools()).toBeNull();
  });

  it("setActiveTools restricts which tools can run", () => {
    const w = makeWorker([noopTool]);
    w.setActiveTools(["read"]);
    expect(w.getActiveTools()).toEqual(["read"]);
  });

  it("setActiveTools(null) restores all-allowed", () => {
    const w = makeWorker([noopTool]);
    w.setActiveTools(["read"]);
    w.setActiveTools(null);
    expect(w.getActiveTools()).toBeNull();
  });
});

describe("LlmWorker.setBashAllowlist", () => {
  it("starts with no allowlist", () => {
    const w = makeWorker([]);
    expect(w.getBashAllowlist()).toBeNull();
  });

  it("setBashAllowlist stores patterns", () => {
    const w = makeWorker([]);
    w.setBashAllowlist([/^ls/, /^cat/]);
    expect(w.getBashAllowlist()).not.toBeNull();
    expect(w.getBashAllowlist()!.length).toBe(2);
  });
});
