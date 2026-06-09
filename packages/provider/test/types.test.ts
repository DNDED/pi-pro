import { describe, it, expect } from "vitest";
import { Message, StreamChunk, Tool, CallOpts, Provider, ContentBlock, isTokenChunk, isToolCallChunk, isDoneChunk } from "../src/types.js";

describe("@pi/provider types", () => {
  it("Message can be a plain string content", () => {
    const m: Message = { role: "user", content: "hello" };
    expect(m.role).toBe("user");
    expect(m.content).toBe("hello");
  });

  it("Message can be an array of content blocks", () => {
    const m: Message = {
      role: "assistant",
      content: [{ type: "text", text: "hi" }],
    };
    expect(Array.isArray(m.content)).toBe(true);
  });

  it("Tool schema has name, description, and input_schema", () => {
    const t: Tool = {
      name: "bash",
      description: "run a shell command",
      input_schema: { type: "object", properties: { cmd: { type: "string" } } },
    };
    expect(t.name).toBe("bash");
    expect(t.input_schema.type).toBe("object");
  });

  it("CallOpts has model and optional fields", () => {
    const o: CallOpts = { model: "test-model", maxTokens: 1024, temperature: 0.7 };
    expect(o.model).toBe("test-model");
    expect(o.maxTokens).toBe(1024);
  });

  it("StreamChunk discriminates by type", () => {
    const t: StreamChunk = { type: "token", text: "hello" };
    const tc: StreamChunk = { type: "tool_call", name: "bash", args: { cmd: "ls" } };
    const d: StreamChunk = { type: "done", usage: { in: 1, out: 2 } };
    expect(isTokenChunk(t)).toBe(true);
    expect(isToolCallChunk(tc)).toBe(true);
    expect(isDoneChunk(d)).toBe(true);
    expect(isTokenChunk(tc)).toBe(false);
  });

  it("ContentBlock can be text or tool_use", () => {
    const text: ContentBlock = { type: "text", text: "x" };
    const tool: ContentBlock = { type: "tool_use", id: "x", name: "bash", input: { cmd: "ls" } };
    expect(text.type).toBe("text");
    expect(tool.type).toBe("tool_use");
  });

  it("Provider is an interface with a name and complete method", () => {
    const p: Provider = {
      name: "test",
      complete: async function* () {
        yield { type: "done" as const, usage: { in: 0, out: 0 } };
      },
    };
    expect(p.name).toBe("test");
    expect(typeof p.complete).toBe("function");
  });
});
