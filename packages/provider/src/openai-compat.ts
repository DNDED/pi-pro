import { Provider, Message, CallOpts, StreamChunk, Tool, ProviderConfig } from "./types.js";

interface OpenAIRequest {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string }>;
  max_tokens?: number;
  temperature?: number;
  tools?: Array<{ type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
  stream: true;
}

class OpenAICompatProvider implements Provider {
  readonly name: string;
  protected readonly apiKey: string | undefined;
  protected readonly baseUrl: string;
  protected readonly defaultModel: string;
  protected readonly requireAuth: boolean;

  constructor(name: string, cfg: ProviderConfig & { requireAuth?: boolean; defaultBaseUrl: string }) {
    this.name = name;
    this.requireAuth = cfg.requireAuth ?? true;
    if (this.requireAuth && !cfg.apiKey) {
      throw new Error(`${name} requires apiKey`);
    }
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl ?? cfg.defaultBaseUrl;
    this.defaultModel = cfg.model;
  }

  async *complete(messages: Message[], opts: CallOpts): AsyncIterable<StreamChunk> {
    const chatMessages: OpenAIRequest["messages"] = [];
    for (const m of messages) {
      if (m.role === "system" || m.role === "user" || m.role === "assistant") {
        chatMessages.push({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content.map(b => b.type === "text" ? b.text : "").join(""),
        });
      }
    }

    const body: OpenAIRequest = {
      model: opts.model ?? this.defaultModel,
      messages: chatMessages,
      stream: true,
    };
    if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools.map((t: Tool) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }));
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok) {
      throw new Error(`${this.name} ${res.status}: ${await res.text()}`);
    }

    if (!res.body) {
      yield { type: "done", usage: { in: 0, out: 0 } };
      return;
    }

    let inTokens = 0;
    let outTokens = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices?.[0]?.delta?.content) {
            yield { type: "token", text: parsed.choices[0].delta.content };
          }
          if (parsed.choices?.[0]?.delta?.tool_calls?.[0]) {
            const tc = parsed.choices[0].delta.tool_calls[0];
            yield { type: "tool_call", name: tc.function?.name ?? "unknown", args: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {} };
          }
          if (parsed.usage) {
            inTokens = parsed.usage.prompt_tokens ?? inTokens;
            outTokens = parsed.usage.completion_tokens ?? outTokens;
          }
        } catch { /* ignore */ }
      }
    }

    yield { type: "done", usage: { in: inTokens, out: outTokens } };
  }
}

export class OpenAIProvider extends OpenAICompatProvider {
  constructor(cfg: ProviderConfig & { baseUrl?: string }) {
    super("openai", { ...cfg, defaultBaseUrl: "https://api.openai.com", requireAuth: true });
  }
}

export class OllamaProvider extends OpenAICompatProvider {
  constructor(cfg: ProviderConfig & { baseUrl?: string }) {
    super("ollama", { ...cfg, defaultBaseUrl: "http://localhost:11434", requireAuth: false, apiKey: undefined });
  }
}

export class OpenRouterProvider extends OpenAICompatProvider {
  constructor(cfg: ProviderConfig & { baseUrl?: string }) {
    super("openrouter", { ...cfg, defaultBaseUrl: "https://openrouter.ai/api", requireAuth: true });
  }
}
