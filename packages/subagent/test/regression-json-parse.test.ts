import { describe, it, expect } from "vitest";
import { LlmWorker } from "../src/llm-worker.js";
import { Provider, Message, CallOpts, StreamChunk } from "@pi/provider";

class RegressionProvider implements Provider {
  name = "regression";
  private chunks: Array<AsyncIterable<StreamChunk>> = [];
  capt: Message[][] = [];
  enqueue(chunks: StreamChunk[]) { this.chunks.push(this.makeIter(chunks)); }
  private async *makeIter(c: StreamChunk[]) { for (const x of c) yield x; }
  async *complete(msgs: Message[], _opts: CallOpts) {
    this.capt.push(msgs);
    const next = this.chunks.shift();
    if (!next) throw new Error("RegressionProvider: no more queued responses");
    for await (const c of next) yield c;
  }
}

function makeWorker(provider: Provider) {
  return new LlmWorker(provider, [], "/tmp", { maxIterations: 1 });
}

describe("regression — JSON parse edge cases", () => {
  it("unterminated evidence string does NOT crash (returns pass)", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"Added app.get(\'/healthz\', (req, res) => res.status(200).json({ status: \'ok\' })' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("single-quoted JSON values get parsed via keyword fallback", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: "{ status: 'pass', evidence: 'works' }" },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("trailing garbage after valid JSON does not crash", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"ok"}Some extra text the model appended' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("JSON with extra commas after last value does not crash", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"done",}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("missing closing brace on valid JSON returns keyword fallback", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"ok"' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("empty evidence value does not crash", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":""}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
    expect(r.evidence).toBe("");
  });

  it("valid JSON with thinking tags before it still parses", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: "<thinking>need to check the tests</thinking>\n\n{\"status\":\"pass\",\"evidence\":\"tests all green\"}" },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
    expect(r.evidence).toContain("green");
  });

  it("JSON with escaped characters in evidence", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"added \\"quoted\\" string and escaped slash \\\\"} ' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("JSON with status at the end of a long text block", async () => {
    const p = new RegressionProvider();
    const prefix = "x".repeat(3000);
    p.enqueue([
      { type: "token", text: prefix + '{"status":"fail","evidence":"tests failed"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("fail");
  });

  it("JSON with wrapped extra braces in evidence", async () => {
    const p = new RegressionProvider();
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"wrote { key: value } object"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = makeWorker(p);
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });
});
