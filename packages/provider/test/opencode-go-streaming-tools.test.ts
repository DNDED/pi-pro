import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { OpenCodeGoProvider } from "../src/opencode-go.js";

// Each test gets a server that streams a fixed SSE event list.
let server: ReturnType<typeof createServer>;
let baseUrl: string;
type Evt = { event?: string; data: string };
let events: Evt[] = [];

beforeEach(async () => {
  events = [];
  server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    void req;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    for (const e of events) {
      const prefix = e.event ? `event: ${e.event}\n` : "";
      res.write(`${prefix}data: ${e.data}\n\n`);
      // small yield to mimic real streaming
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

const toolCallChunks = async (p: OpenCodeGoProvider) => {
  const out: Array<{ type: string; id?: string; name?: string; args?: unknown }> = [];
  for await (const c of p.complete([{ role: "user", content: "x" }], { model: "minimax-m3" })) {
    if (c.type === "tool_call") out.push(c);
  }
  return out;
};

describe("OpenCodeGoProvider — streaming tool_use accumulator", () => {
  it("accumulates input_json_delta into the final tool_call args", async () => {
    // This is the regression test for the v0.4 bench bug. Anthropic
    // (and OpenCode Go's wire-compatible endpoint) sends:
    //   content_block_start: {type:tool_use, input: {}}      <- ALWAYS empty
    //   content_block_delta:  {delta: {type: input_json_delta, partial_json: "..."}}
    //   content_block_delta:  {delta: {type: input_json_delta, partial_json: "..."}}
    //   content_block_stop
    // We must NOT yield on content_block_start (the input is always
    // {} on the wire). We accumulate the deltas and JSON.parse once
    // on content_block_stop.
    events = [
      { data: JSON.stringify({ type: "message_start", message: { id: "m1", type: "message", role: "assistant", content: [], model: "minimax-m3", usage: { input_tokens: 10, output_tokens: 0 } } }) },
      { data: JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call_1", name: "bash", input: {} } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{\"cmd\":" } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: " \"ls -la\"}" } }) },
      { data: JSON.stringify({ type: "content_block_stop", index: 0 }) },
      { data: JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 5 } }) },
      { data: JSON.stringify({ type: "message_stop" }) },
    ];
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    const tcs = await toolCallChunks(p);
    expect(tcs).toHaveLength(1);
    expect(tcs[0].id).toBe("call_1");
    expect(tcs[0].name).toBe("bash");
    expect(tcs[0].args).toEqual({ cmd: "ls -la" });
  });

  it("emits a single tool_call even when input arrives across many deltas", async () => {
    events = [
      { data: JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } }) },
      { data: JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call_X", name: "read", input: {} } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{" } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "\"path\":" } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: " \"/tmp/x.txt\"" } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "}" } }) },
      { data: JSON.stringify({ type: "content_block_stop", index: 0 }) },
      { data: JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 1 } }) },
      { data: JSON.stringify({ type: "message_stop" }) },
    ];
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    const tcs = await toolCallChunks(p);
    expect(tcs).toHaveLength(1);
    expect(tcs[0].id).toBe("call_X");
    expect(tcs[0].name).toBe("read");
    expect(tcs[0].args).toEqual({ path: "/tmp/x.txt" });
  });

  it("yields an empty-args tool_call when the model emits a tool_use with no input deltas", async () => {
    // Some tools take no parameters. The stream may end with
    // content_block_stop right after content_block_start (no
    // input_json_delta at all). We must still yield the tool_call
    // with args={} (the JSON.parse of "" is "" which is falsy, so
    // args stay {}).
    events = [
      { data: JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } }) },
      { data: JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call_0", name: "list", input: {} } }) },
      { data: JSON.stringify({ type: "content_block_stop", index: 0 }) },
      { data: JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 1 } }) },
      { data: JSON.stringify({ type: "message_stop" }) },
    ];
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    const tcs = await toolCallChunks(p);
    expect(tcs).toHaveLength(1);
    expect(tcs[0].id).toBe("call_0");
    expect(tcs[0].name).toBe("list");
    expect(tcs[0].args).toEqual({});
  });

  it("falls back to empty args when accumulated input_json is malformed", async () => {
    // Defensive: if the model emits deltas that don't form valid
    // JSON, we should yield the tool_call with args={} rather than
    // throwing and aborting the whole stream.
    events = [
      { data: JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } }) },
      { data: JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call_bad", name: "x", input: {} } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "this is not json" } }) },
      { data: JSON.stringify({ type: "content_block_stop", index: 0 }) },
      { data: JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 1 } }) },
      { data: JSON.stringify({ type: "message_stop" }) },
    ];
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    const tcs = await toolCallChunks(p);
    expect(tcs).toHaveLength(1);
    expect(tcs[0].args).toEqual({});
  });

  it("yields text deltas as tokens, separately from tool_calls", async () => {
    events = [
      { data: JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 1 } } }) },
      { data: JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hello " } }) },
      { data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "world" } }) },
      { data: JSON.stringify({ type: "content_block_stop", index: 0 }) },
      { data: JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } }) },
      { data: JSON.stringify({ type: "message_stop" }) },
    ];
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    const tokens: string[] = [];
    for await (const c of p.complete([{ role: "user", content: "x" }], { model: "minimax-m3" })) {
      if (c.type === "token") tokens.push(c.text);
    }
    expect(tokens.join("")).toBe("hello world");
  });
});
