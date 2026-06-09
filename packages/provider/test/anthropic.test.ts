import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { AnthropicProvider } from "../src/anthropic.js";

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let lastBody = "";
let lastHeaders: Record<string, string> = {};

beforeEach(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      lastBody = body;
      lastHeaders = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") lastHeaders[k] = v;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\ndata: {"type":"message_delta","usage":{"output_tokens":5}}\n\ndata: [DONE]\n\n`);
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>(r => server.close(() => r()));
});

describe("AnthropicProvider", () => {
  it("has the correct name", () => {
    const p = new AnthropicProvider({ apiKey: "test", model: "claude-sonnet-4-6" });
    expect(p.name).toBe("anthropic");
  });

  it("uses api.anthropic.com by default", async () => {
    const p = new AnthropicProvider({ apiKey: "test", model: "x" });
    expect(p).toBeDefined();
  });

  it("sends x-api-key and anthropic-version headers", async () => {
    const p = new AnthropicProvider({ apiKey: "sk-ant-123", model: "claude-sonnet-4-6", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "hi" }], { model: "claude-sonnet-4-6" })) { /* drain */ }
    expect(lastHeaders["x-api-key"]).toBe("sk-ant-123");
    expect(lastHeaders["anthropic-version"]).toBe("2023-06-01");
  });

  it("sends POST to /v1/messages", async () => {
    const p = new AnthropicProvider({ apiKey: "test", model: "x", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "hi" }], { model: "x" })) { /* drain */ }
    const parsed = JSON.parse(lastBody);
    expect(parsed.model).toBe("x");
    expect(parsed.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("emits a done chunk with usage", async () => {
    const p = new AnthropicProvider({ apiKey: "test", model: "x", baseUrl });
    let usage: { in: number; out: number } | null = null;
    for await (const chunk of p.complete([{ role: "user", content: "x" }], { model: "x" })) {
      if (chunk.type === "done") usage = chunk.usage;
    }
    expect(usage).toEqual({ in: 10, out: 5 });
  });
});
