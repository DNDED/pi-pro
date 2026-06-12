import { describe, it, expect } from "vitest";
import { LlmWorker } from "../src/llm-worker.js";
import { Provider, Message, CallOpts, StreamChunk } from "@pi/provider";

class TestProvider implements Provider {
  name = "test";
  private chunks: Array<AsyncIterable<StreamChunk>> = [];
  captured: Message[][] = [];

  enqueue(chunks: StreamChunk[]): void {
    this.chunks.push((async function* () { for (const c of chunks) yield c; })());
  }

  async *complete(msgs: Message[], _opts: CallOpts): AsyncIterable<StreamChunk> {
    this.captured.push(msgs);
    const next = this.chunks.shift();
    if (!next) throw new Error("TestProvider: no more queued responses");
    for await (const c of next) yield c;
  }
}

function makeWorker(provider: Provider) {
  return new LlmWorker(provider, [], "/tmp", { maxIterations: 2 });
}

describe("parseResult — flexible status parsing", () => {
  it("returns pass when JSON has unterminated evidence string", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"Fixed code' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("returns fail when text contains fail keyword", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "The tests failed with an error" },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("fail");
  });

  it("returns blocked when text contains blocked keyword", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "I am blocked because I cannot install pytest" },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("blocked");
  });

  it("returns pass for long text without explicit status keywords", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "I have completed all the changes. The refactor extracted the helper function successfully. Everything works as expected." },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("returns blocked for unknown short text", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "ok" },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("blocked");
  });
});
