import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { OpenCodeGoProvider } from "../src/opencode-go.js";

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let lastBody = "";

beforeEach(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      lastBody = body;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "minimax-m3",
        content: [{ type: "text", text: "Hello from MiniMax" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 42, output_tokens: 7 },
      }));
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>(r => server.close(() => r()));
});

describe("OpenCodeGoProvider — JSON fallback (MiniMax style)", () => {
  it("parses a non-streaming JSON response when the server ignores stream=true", async () => {
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    const tokens: string[] = [];
    let doneUsage: { in: number; out: number } | null = null;
    for await (const chunk of p.complete([{ role: "user", content: "hi" }], { model: "minimax-m3" })) {
      if (chunk.type === "token") tokens.push(chunk.text);
      if (chunk.type === "done") doneUsage = chunk.usage;
    }
    expect(tokens.join("")).toBe("Hello from MiniMax");
    expect(doneUsage).toEqual({ in: 42, out: 7 });
  });

  it("sends stream: true in the body so the server knows to stream", async () => {
    const p = new OpenCodeGoProvider({ apiKey: "sk-test", model: "minimax-m3", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "x" }], { model: "minimax-m3" })) { /* drain */ }
    const parsed = JSON.parse(lastBody);
    expect(parsed.stream).toBe(true);
  });
});
