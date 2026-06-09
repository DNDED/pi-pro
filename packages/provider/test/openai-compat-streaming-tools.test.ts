import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { OpenAIProvider } from "../src/openai-compat.js";

let server: ReturnType<typeof createServer>;
let baseUrl: string;
type Evt = { data: string };
let events: Evt[] = [];

beforeEach(async () => {
  events = [];
  server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    void req;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    for (const e of events) {
      res.write(`data: ${e.data}\n\n`);
      await new Promise<void>(r => setImmediate(r));
    }
    res.end();
  });
  await new Promise<void>(r => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>(r => server.close(() => r()));
});

const toolCallChunks = async (p: OpenAIProvider) => {
  const out: Array<{ type: string; id?: string; name?: string; args?: unknown }> = [];
  for await (const c of p.complete([{ role: "user", content: "x" }], { model: "x" })) {
    if (c.type === "tool_call") out.push(c);
  }
  return out;
};

describe("OpenAIProvider — streaming tool_calls accumulator", () => {
  // OpenAI's wire format: the first delta has id+name+start of arguments,
  // subsequent deltas have only arguments as a partial JSON string.
  // The OLD code called JSON.parse(arguments) on every delta — broken.
  // The NEW code accumulates arguments across deltas and parses once
  // when finish_reason === "tool_calls".
  it("accumulates partial arguments across deltas and parses once on finish", async () => {
    events = [
      { data: JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "bash", arguments: '{"cmd":' } }] } }] }) },
      { data: JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ' "ls' } }] } }] }) },
      { data: JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ' -la"}' } }] } }] }) },
      { data: JSON.stringify({ choices: [{ finish_reason: "tool_calls" }] }) },
      { data: "[DONE]" },
    ];
    const p = new OpenAIProvider({ apiKey: "sk", baseUrl, model: "x" });
    const tcs = await toolCallChunks(p);
    expect(tcs).toHaveLength(1);
    expect(tcs[0].id).toBe("call_1");
    expect(tcs[0].name).toBe("bash");
    expect(tcs[0].args).toEqual({ cmd: "ls -la" });
  });

  it("yields a tool_call with empty args when arguments are never provided", async () => {
    events = [
      { data: JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_X", function: { name: "ping", arguments: "" } }] } }] }) },
      { data: JSON.stringify({ choices: [{ finish_reason: "tool_calls" }] }) },
      { data: "[DONE]" },
    ];
    const p = new OpenAIProvider({ apiKey: "sk", baseUrl, model: "x" });
    const tcs = await toolCallChunks(p);
    expect(tcs).toHaveLength(1);
    expect(tcs[0].id).toBe("call_X");
    expect(tcs[0].name).toBe("ping");
    expect(tcs[0].args).toEqual({});
  });

  it("flushes tool_calls on [DONE] even when no finish_reason deltas arrive", async () => {
    // Some servers (and the opencode-go-zen endpoint) close the stream
    // with [DONE] without a final finish_reason delta. The provider
    // must still yield any accumulated tool_calls.
    events = [
      { data: JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_Z", function: { name: "x", arguments: "{\"a\":1}" } }] } }] }) },
      { data: "[DONE]" },
    ];
    const p = new OpenAIProvider({ apiKey: "sk", baseUrl, model: "x" });
    const tcs = await toolCallChunks(p);
    expect(tcs).toHaveLength(1);
    expect(tcs[0].args).toEqual({ a: 1 });
  });

  it("emits text deltas as tokens (no regression on content)", async () => {
    events = [
      { data: JSON.stringify({ choices: [{ delta: { content: "hi " } }] }) },
      { data: JSON.stringify({ choices: [{ delta: { content: "there" } }] }) },
      { data: JSON.stringify({ choices: [{ finish_reason: "stop" }] }) },
      { data: "[DONE]" },
    ];
    const p = new OpenAIProvider({ apiKey: "sk", baseUrl, model: "x" });
    const tokens: string[] = [];
    for await (const c of p.complete([{ role: "user", content: "x" }], { model: "x" })) {
      if (c.type === "token") tokens.push(c.text);
    }
    expect(tokens.join("")).toBe("hi there");
  });
});
