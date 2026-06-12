import { describe, it, expect } from "vitest";
import { LlmWorker } from "../src/llm-worker.js";
import { Provider, Message, CallOpts, StreamChunk } from "@pi/provider";

class FuzzProvider implements Provider {
  name = "fuzz";
  private chunks: Array<AsyncIterable<StreamChunk>> = [];
  capt: Message[][] = [];
  enqueue(chunks: StreamChunk[]) { this.chunks.push(this.makeIter(chunks)); }
  private async *makeIter(c: StreamChunk[]) { for (const x of c) yield x; }
  async *complete(msgs: Message[], _opts: CallOpts) {
    this.capt.push(msgs);
    const next = this.chunks.shift();
    if (!next) throw new Error("FuzzProvider: no more queued responses");
    for await (const c of next) yield c;
  }
}

describe("parseResult — property tests", () => {
  it("never throws for random text inputs", async () => {
    const inputs = [
      "",
      "x",
      "{",
      "}",
      '{"status":',
      '{"status":"weird"}',
      "pass",
      "fail pass blocked",
      "   ",
      "\n\t\r",
      '{"status":"pass","evidence":"broken json',
      "<thinking>reasoning</thinking>",
      '{"status": "ok"}',
    ];
    for (const text of inputs) {
      const p = new FuzzProvider();
      p.enqueue([
        { type: "token", text },
        { type: "done", usage: { in: 1, out: 1 } },
      ]);
      const w = new LlmWorker(p, [], "/tmp", { maxIterations: 1 });
      const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
      expect(["pass", "fail", "blocked"]).toContain(r.status);
      expect(typeof r.evidence).toBe("string");
    }
  });

  it("returns pass/fail/blocked for all valid status values in JSON", async () => {
    const statuses = ["pass", "fail", "blocked"];
    for (const status of statuses) {
      const p = new FuzzProvider();
      p.enqueue([
        { type: "token", text: `{"status":"${status}","evidence":"test evidence string"}` },
        { type: "done", usage: { in: 1, out: 1 } },
      ]);
      const w = new LlmWorker(p, [], "/tmp", { maxIterations: 1 });
      const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
      expect(r.status).toBe(status);
    }
  });

  it("JSON status regex rejects non-pass/fail/blocked status values", async () => {
    const p = new FuzzProvider();
    p.enqueue([
      { type: "token", text: '{"status":"ok","evidence":"not a valid status"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = new LlmWorker(p, [], "/tmp", { maxIterations: 1 });
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("blocked");
    expect(r.evidence).toMatch(/determine status/);
  });

  it("handles JSON with whitespace and newlines around status", async () => {
    const p = new FuzzProvider();
    p.enqueue([
      { type: "token", text: '{\n  "status"\n  :\n  "pass"\n,\n"evidence":"\\nmultiline\\nevidence"\n}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = new LlmWorker(p, [], "/tmp", { maxIterations: 1 });
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
  });

  it("falls back to keyword detection when JSON fails to parse", async () => {
    const tests: Array<[string, "pass" | "fail" | "blocked"]> = [
      ['{ status: "pass" }', "pass"],
      ['{ status: "fail" }', "fail"],
      ['{ status: "blocked" }', "blocked"],
      ["process completed successfully", "pass"],
      ["tests running and passing", "pass"],
      ["build failed with error", "fail"],
      ["broken pipeline detected", "fail"],
      ["I cannot proceed, missing dependency", "blocked"],
      ["unable to execute the task", "blocked"],
    ];
    for (const [text, expected] of tests) {
      const p = new FuzzProvider();
      p.enqueue([
        { type: "token", text },
        { type: "done", usage: { in: 1, out: 1 } },
      ]);
      const w = new LlmWorker(p, [], "/tmp", { maxIterations: 1 });
      const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
      expect(r.status).toBe(expected);
    }
  });
});
