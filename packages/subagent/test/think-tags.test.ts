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

describe("think-tags — reasoning containment", () => {
  it("does not crash when text contains thinking tags", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "<thinking>This is a lot of reasoning that the model might produce before acting. It should be stripped from the context.</thinking>" },
      { type: "token", text: '{"status":"pass","evidence":"done"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = new LlmWorker(p, [], "/tmp", { maxIterations: 2 });
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("injects nudge when thinking exceeds limit without action", async () => {
    const p = new TestProvider();
    const longText = "thinking ".repeat(200);
    p.enqueue([
      { type: "token", text: longText },
      { type: "done", usage: { in: 2, out: 2 } },
    ]);
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"fine"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = new LlmWorker(p, [], "/tmp", { maxIterations: 4, maxThinkingChars: 1500 });
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
    const userMsgs = p.captured.flat().filter((m) => m.role === "user");
    const nudgeFound = userMsgs.some(
      (m) => typeof m.content === "string" && (m.content as string).includes("Stop analyzing"),
    );
    expect(nudgeFound).toBe(true);
  });
});
