import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { OpenCodeGoProvider } from "../src/opencode-go.js";

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let requests: Array<{ method: string; url: string; body: string; headers: Record<string, string> }> = [];

beforeEach(async () => {
  requests = [];
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(",");
      }
      requests.push({ method: req.method ?? "?", url: req.url ?? "?", body, headers });
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`data: {"type":"message_start","message":{"usage":{"input_tokens":42}}}\n\ndata: {"type":"message_delta","usage":{"output_tokens":7}}\n\ndata: [DONE]\n\n`);
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>(r => server.close(() => r()));
});

describe("OpenCodeGoProvider", () => {
  it("has the correct name", () => {
    const p = new OpenCodeGoProvider({ apiKey: "test-key", model: "minimax-m3" });
    expect(p.name).toBe("opencode-go");
  });

  it("sends POST to /v1/messages with x-api-key header and anthropic-version", async () => {
    const p = new OpenCodeGoProvider({ apiKey: "sk-test-123", model: "minimax-m3", baseUrl });
    const events: string[] = [];
    for await (const chunk of p.complete(
      [{ role: "user", content: "hi" }],
      { model: "minimax-m3", maxTokens: 100 }
    )) {
      events.push(chunk.type);
    }
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe("/v1/messages");
    expect(requests[0].headers["x-api-key"]).toBe("sk-test-123");
    expect(requests[0].headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("emits a done chunk with token usage", async () => {
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    const chunks: Array<{ type: string; usage?: { in: number; out: number } }> = [];
    for await (const chunk of p.complete([{ role: "user", content: "x" }], { model: "minimax-m3" })) {
      if (chunk.type === "done") chunks.push({ type: "done", usage: chunk.usage });
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].usage?.in).toBe(42);
    expect(chunks[0].usage?.out).toBe(7);
  });

  it("sends system messages in the system field, not as a user message", async () => {
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    for await (const _ of p.complete(
      [
        { role: "system", content: "you are helpful" },
        { role: "user", content: "hi" },
      ],
      { model: "minimax-m3" }
    )) { /* drain */ }
    const parsed = JSON.parse(requests[0].body);
    expect(parsed.system).toBe("you are helpful");
    expect(parsed.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("passes tools as the anthropic-format tools array", async () => {
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    for await (const _ of p.complete(
      [{ role: "user", content: "x" }],
      { model: "minimax-m3", tools: [{ name: "bash", description: "run a command", input_schema: { type: "object", properties: { cmd: { type: "string" } } } }] }
    )) { /* drain */ }
    const parsed = JSON.parse(requests[0].body);
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.tools[0].name).toBe("bash");
    expect(parsed.tools[0].input_schema.properties.cmd.type).toBe("string");
  });
});
