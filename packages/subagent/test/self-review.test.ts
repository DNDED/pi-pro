import { describe, it, expect } from "vitest";
import { LlmWorker, ToolInstance } from "../src/llm-worker.js";
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

function makeEditTool(): ToolInstance {
  return {
    name: "edit",
    description: "edit a file",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, oldText: { type: "string" }, newText: { type: "string" } },
    },
    async execute(args: Record<string, unknown>) {
      return "File edited successfully";
    },
  };
}

function makeWriteTool(): ToolInstance {
  return {
    name: "write",
    description: "write a file",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
    },
    async execute(args: Record<string, unknown>) {
      return "File written successfully";
    },
  };
}

describe("self-review — diff review nudge", () => {
  it("adds self-review nudge after edit tool calls", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "I will edit the file now." },
      { type: "tool_call", id: "e1", name: "edit", args: { path: "server.js", oldText: "old", newText: "new" } },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"done"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = new LlmWorker(p, [makeEditTool()], "/tmp", { maxIterations: 4 });
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
    const userMsgs = p.captured.flat().filter((m) => m.role === "user");
    const reviewFound = userMsgs.some((m) => {
      if (Array.isArray(m.content)) {
        return m.content.some(
          (b: { type: string; content?: string }) =>
            b.type === "tool_result" && typeof b.content === "string" && b.content.includes("Self-review"),
        );
      }
      return false;
    });
    expect(reviewFound).toBe(true);
  });

  it("adds self-review nudge after write tool calls", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "I will write a new file now." },
      { type: "tool_call", id: "w1", name: "write", args: { path: "newfile.ts", content: "console.log('hello')" } },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"done"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const w = new LlmWorker(p, [makeWriteTool()], "/tmp", { maxIterations: 4 });
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
    const userMsgs = p.captured.flat().filter((m) => m.role === "user");
    const reviewFound = userMsgs.some((m) => {
      if (Array.isArray(m.content)) {
        return m.content.some(
          (b: { type: string; content?: string }) =>
            b.type === "tool_result" && typeof b.content === "string" && b.content.includes("Self-review"),
        );
      }
      return false;
    });
    expect(reviewFound).toBe(true);
  });

  it("does not add self-review for non-edit/write tools", async () => {
    const p = new TestProvider();
    p.enqueue([
      { type: "token", text: "Let me read the file first." },
      { type: "tool_call", id: "r1", name: "read", args: { path: "server.js" } },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    p.enqueue([
      { type: "token", text: '{"status":"pass","evidence":"done"}' },
      { type: "done", usage: { in: 1, out: 1 } },
    ]);
    const readTool: ToolInstance = {
      name: "read",
      description: "read a file",
      input_schema: { type: "object", properties: { path: { type: "string" } } },
      async execute(args: Record<string, unknown>) {
        return "File contents here";
      },
    };
    const w = new LlmWorker(p, [readTool], "/tmp", { maxIterations: 4 });
    const r = await w.run("build", { taskId: "t", stepId: "s", description: "x", worktreePath: "/tmp" });
    expect(r.status).toBe("pass");
    const userMsgs = p.captured.flat().filter((m) => m.role === "user");
    const reviewFound = userMsgs.some((m) => {
      if (Array.isArray(m.content)) {
        return m.content.some(
          (b: { type: string; content?: string }) =>
            b.type === "tool_result" && typeof b.content === "string" && b.content.includes("Self-review"),
        );
      }
      return false;
    });
    expect(reviewFound).toBe(false);
  });
});
