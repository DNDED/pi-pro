import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { LlmWorker } from "../src/llm-worker.js";
import { Provider, Message, CallOpts, StreamChunk } from "@pi/provider";
import { StepContext } from "../src/types.js";
import { createBashTool, createEditTool, createReadTool, createWriteTool, createGrepTool, createGlobTool } from "@pi/tools";

class FakeProvider implements Provider {
  name = "fake";
  responses: Array<AsyncIterable<StreamChunk>> = [];
  callIndex = 0;
  captured: Array<{ messages: Message[]; opts: CallOpts }> = [];

  queue(chunks: StreamChunk[]): void {
    this.responses.push((async function* () { for (const c of chunks) yield c; })());
  }

  async *complete(messages: Message[], opts: CallOpts): AsyncIterable<StreamChunk> {
    this.captured.push({ messages, opts });
    const r = this.responses[this.callIndex++];
    if (!r) throw new Error("FakeProvider: no more queued responses");
    for await (const c of r) yield c;
  }
}

let workdir: string;
beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "llm-worker-"));
  execSync("git init -q", { cwd: workdir });
  execSync("git config user.email t@local", { cwd: workdir });
  execSync("git config user.name t", { cwd: workdir });
  execSync("git commit --allow-empty -q -m init", { cwd: workdir });
});
afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

const ctx = (overrides: Partial<StepContext> = {}): StepContext => ({
  taskId: "tsk_abc123",
  stepId: "s1",
  description: "Add a /healthz endpoint",
  worktreePath: workdir,
  ...overrides,
});

describe("LlmWorker", () => {
  it("returns pass when the model emits a JSON status in a text block", async () => {
    const p = new FakeProvider();
    p.queue([
      { type: "token", text: '{"status": "pass", "evidence": "added /healthz returning 200"}' },
      { type: "done", usage: { in: 100, out: 20 } },
    ]);
    const w = new LlmWorker(p, [createBashTool(), createReadTool(), createWriteTool(), createEditTool(), createGrepTool(), createGlobTool()], workdir);
    const r = await w.run("build", ctx());
    expect(r.status).toBe("pass");
    expect(r.evidence).toContain("healthz");
    expect(r.tokensIn).toBe(100);
    expect(r.tokensOut).toBe(20);
  });

  it("returns fail when the model emits status=fail", async () => {
    const p = new FakeProvider();
    p.queue([
      { type: "token", text: '{"status": "fail", "evidence": "could not run tests"}' },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createBashTool()], workdir);
    const r = await w.run("build", ctx());
    expect(r.status).toBe("fail");
  });

  it("returns blocked when the model never emits a JSON status", async () => {
    const p = new FakeProvider();
    p.queue([
      { type: "token", text: "I think this is a good idea but let me think more" },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createBashTool()], workdir);
    const r = await w.run("build", ctx());
    expect(r.status).toBe("blocked");
    expect(r.evidence).toMatch(/JSON status/);
  });

  it("restricts the tool schema to only the role's allowed tools", async () => {
    const p = new FakeProvider();
    p.queue([
      { type: "token", text: '{"status": "pass", "evidence": "review only"}' },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createReadTool(), createGrepTool(), createGlobTool()], workdir);
    await w.run("code-reviewer", ctx());
    const opts = p.captured[0].opts;
    expect(opts.tools).toBeDefined();
    const names = (opts.tools ?? []).map(t => t.name);
    expect(names).toContain("read");
    expect(names).toContain("grep");
    expect(names).toContain("glob");
    expect(names).not.toContain("bash");
    expect(names).not.toContain("write");
  });

  it("executes a tool_call and feeds the result back to the model", async () => {
    const p = new FakeProvider();
    p.queue([
      { type: "tool_call", name: "bash", args: { cmd: "echo test-output" } },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    p.queue([
      { type: "token", text: '{"status": "pass", "evidence": "echoed test-output"}' },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createBashTool()], workdir);
    const r = await w.run("build", ctx());
    expect(r.status).toBe("pass");
    expect(p.captured).toHaveLength(2);
    const secondCall = p.captured[1].messages;
    // Anthropic Messages API: tool results come back as a user-role
    // message containing `tool_result` content blocks (one per tool_use).
    const userMessageWithToolResult = secondCall.find(m => m.role === "user" && Array.isArray(m.content) && m.content.some((b: { type: string }) => b.type === "tool_result"));
    expect(userMessageWithToolResult).toBeDefined();
    expect(JSON.stringify(userMessageWithToolResult)).toContain("test-output");
  });

  it("times out after maxIterations to prevent infinite loops", async () => {
    const p = new FakeProvider();
    for (let i = 0; i < 12; i++) {
      p.queue([
        { type: "tool_call", name: "bash", args: { cmd: "echo loop" } },
        { type: "done", usage: { in: 0, out: 0 } },
      ]);
    }
    const w = new LlmWorker(p, [createBashTool()], workdir, { maxIterations: 3 });
    const r = await w.run("build", ctx());
    expect(r.status).toBe("blocked");
    expect(r.evidence).toMatch(/iterations|limit/i);
  });

  it("force-concludes at tool budget: 6 tool calls without a status, then the model emits pass/fail (not blocked)", async () => {
    const p = new FakeProvider();
    for (let i = 0; i < 5; i++) {
      p.queue([
        { type: "tool_call", name: "bash", args: { cmd: `echo step${i}` } },
        { type: "done", usage: { in: 0, out: 0 } },
      ]);
    }
    p.queue([
      { type: "tool_call", name: "bash", args: { cmd: "echo final" } },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    p.queue([
      { type: "token", text: '{"status": "pass", "evidence": "all done"}' },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createBashTool()], workdir, { toolBudget: 6 });
    const r = await w.run("build", ctx());
    expect(r.status).toBe("pass");
    expect(r.evidence).toContain("all done");
    const allMessages = p.captured.flatMap(c => c.messages);
    const forceConcludeMsg = allMessages.find(m =>
      typeof m.content === "string" && m.content.includes("You have used") && m.content.includes("tools"),
    );
    expect(forceConcludeMsg).toBeDefined();
  });

  it("double-budget hard-stop: 12 tool calls without a status yields blocked with the budget message", async () => {
    const p = new FakeProvider();
    for (let i = 0; i < 7; i++) {
      p.queue([
        { type: "tool_call", name: "bash", args: { cmd: `echo a${i}` } },
        { type: "tool_call", name: "bash", args: { cmd: `echo b${i}` } },
        { type: "done", usage: { in: 0, out: 0 } },
      ]);
    }
    const w = new LlmWorker(p, [createBashTool()], workdir, { toolBudget: 6, maxIterations: 10 });
    const r = await w.run("build", ctx());
    expect(r.status).toBe("blocked");
    expect(r.evidence).toMatch(/tool budget/i);
  });

  it("force-conclude message is in the messages array sent to the model after the budget threshold", async () => {
    const p = new FakeProvider();
    for (let i = 0; i < 7; i++) {
      p.queue([
        { type: "tool_call", name: "bash", args: { cmd: `echo step${i}` } },
        { type: "done", usage: { in: 0, out: 0 } },
      ]);
    }
    p.queue([
      { type: "token", text: '{"status": "pass", "evidence": "judged from context"}' },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createBashTool()], workdir, { toolBudget: 6 });
    await w.run("build", ctx());
    const allMessages = p.captured.flatMap(c => c.messages);
    const forceConcludeMsg = allMessages.find(m =>
      typeof m.content === "string" && m.content.includes("You have used") && m.content.includes("tools"),
    );
    expect(forceConcludeMsg).toBeDefined();
  });

  it("applies default per-role tool budgets: test-runner budget=1 triggers force-conclude after 1 tool call", async () => {
    const p = new FakeProvider();
    p.queue([
      { type: "tool_call", name: "bash", args: { cmd: "echo a" } },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    p.queue([
      { type: "token", text: '{"status": "pass", "evidence": "ok"}' },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createBashTool(), createReadTool()], workdir);
    const r = await w.run("test-runner", ctx());
    expect(r.status).toBe("pass");
    const allMessages = p.captured.flatMap(c => c.messages);
    const forceConcludeMsg = allMessages.find(m =>
      typeof m.content === "string" && m.content.includes("You have used 1 tools"),
    );
    expect(forceConcludeMsg).toBeDefined();
  });

  it("per-role override via toolBudgets wins over the global toolBudget", async () => {
    const p = new FakeProvider();
    p.queue([
      { type: "tool_call", name: "bash", args: { cmd: "echo a" } },
      { type: "tool_call", name: "bash", args: { cmd: "echo b" } },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    p.queue([
      { type: "token", text: '{"status": "pass", "evidence": "ok"}' },
      { type: "done", usage: { in: 0, out: 0 } },
    ]);
    const w = new LlmWorker(p, [createBashTool()], workdir, {
      toolBudget: 100,
      toolBudgets: { build: 2 },
    });
    const r = await w.run("build", ctx());
    expect(r.status).toBe("pass");
    const allMessages = p.captured.flatMap(c => c.messages);
    const forceConcludeMsg = allMessages.find(m =>
      typeof m.content === "string" && m.content.includes("You have used 2 tools"),
    );
    expect(forceConcludeMsg).toBeDefined();
  });
});
