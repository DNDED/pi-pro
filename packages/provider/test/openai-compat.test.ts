import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { OpenAIProvider, OllamaProvider, OpenRouterProvider } from "../src/openai-compat.js";

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let requests: Array<{ body: string; auth: string | undefined }> = [];

beforeEach(async () => {
  requests = [];
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      requests.push({ body, auth: req.headers.authorization });
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: {"usage":{"prompt_tokens":11,"completion_tokens":3}}\n\ndata: [DONE]\n\n`);
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>(r => server.close(() => r()));
});

describe("OpenAIProvider", () => {
  it("has name 'openai'", () => {
    const p = new OpenAIProvider({ apiKey: "test", model: "gpt-4o" });
    expect(p.name).toBe("openai");
  });

  it("sends Bearer auth header", async () => {
    const p = new OpenAIProvider({ apiKey: "sk-openai-123", model: "gpt-4o", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "hi" }], { model: "gpt-4o" })) { /* drain */ }
    expect(requests[0].auth).toBe("Bearer sk-openai-123");
  });

  it("sends POST to /v1/chat/completions", async () => {
    const p = new OpenAIProvider({ apiKey: "test", model: "gpt-4o", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "hi" }], { model: "gpt-4o" })) { /* drain */ }
    const parsed = JSON.parse(requests[0].body);
    expect(parsed.model).toBe("gpt-4o");
    expect(parsed.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(parsed.stream).toBe(true);
  });

  it("yields a token chunk and a done chunk with usage", async () => {
    const p = new OpenAIProvider({ apiKey: "test", model: "gpt-4o", baseUrl });
    const tokens: string[] = [];
    let usage: { in: number; out: number } | null = null;
    for await (const chunk of p.complete([{ role: "user", content: "x" }], { model: "gpt-4o" })) {
      if (chunk.type === "token") tokens.push(chunk.text);
      if (chunk.type === "done") usage = chunk.usage;
    }
    expect(tokens).toEqual(["hi"]);
    expect(usage).toEqual({ in: 11, out: 3 });
  });
});

describe("OllamaProvider", () => {
  it("has name 'ollama'", () => {
    const p = new OllamaProvider({ model: "llama3" });
    expect(p.name).toBe("ollama");
  });

  it("does not require apiKey", () => {
    expect(() => new OllamaProvider({ model: "llama3" })).not.toThrow();
  });

  it("defaults to localhost:11434", () => {
    const p = new OllamaProvider({ model: "llama3" });
    expect(p).toBeDefined();
  });

  it("sends POST to /v1/chat/completions", async () => {
    const p = new OllamaProvider({ model: "llama3", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "hi" }], { model: "llama3" })) { /* drain */ }
    const parsed = JSON.parse(requests[0].body);
    expect(parsed.model).toBe("llama3");
  });

  it("omits Authorization header", async () => {
    const p = new OllamaProvider({ model: "llama3", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "x" }], { model: "llama3" })) { /* drain */ }
    expect(requests[0].auth).toBeUndefined();
  });
});

describe("OpenRouterProvider", () => {
  it("has name 'openrouter'", () => {
    const p = new OpenRouterProvider({ apiKey: "test", model: "anthropic/claude-sonnet-4-6" });
    expect(p.name).toBe("openrouter");
  });

  it("requires apiKey", () => {
    expect(() => new OpenRouterProvider({ model: "x" } as never)).toThrow();
  });

  it("sends Bearer auth to openrouter.ai", async () => {
    const p = new OpenRouterProvider({ apiKey: "sk-or-123", model: "anthropic/claude-sonnet-4-6", baseUrl });
    for await (const _ of p.complete([{ role: "user", content: "hi" }], { model: "anthropic/claude-sonnet-4-6" })) { /* drain */ }
    expect(requests[0].auth).toBe("Bearer sk-or-123");
    const parsed = JSON.parse(requests[0].body);
    expect(parsed.model).toBe("anthropic/claude-sonnet-4-6");
  });
});
