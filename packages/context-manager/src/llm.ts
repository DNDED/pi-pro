import type { ContextMessage, CompressionConfig, BtwResult, BtwOpts } from "./types.js";
import type { Provider, Message, StreamChunk } from "@pi/provider";

export interface SummarizeOpts {
  signal?: AbortSignal;
  maxOutputTokens?: number;
}

export class Summarizer {
  private readonly provider: Provider;
  private readonly model: string;

  constructor(provider: Provider, model: string) {
    this.provider = provider;
    this.model = model;
  }

  async summarize(messages: ContextMessage[], opts: SummarizeOpts = {}): Promise<ContextMessage> {
    const prompt = this.buildPrompt(messages);
    const providerMessages: Message[] = [
      { role: "system", content: "You are a concise summarizer. Preserve key facts, decisions, code references, and tool results. Drop chitchat." },
      { role: "user", content: prompt },
    ];
    const result = await this.collectResponse(providerMessages, opts);
    return {
      role: "assistant",
      content: result.text,
      synthetic: true,
    };
  }

  private buildPrompt(messages: ContextMessage[]): string {
    const parts: string[] = [];
    parts.push("Summarize the following conversation. Be concise but preserve:");
    parts.push("- Key facts and decisions");
    parts.push("- File paths and code references");
    parts.push("- Tool results that affected the work");
    parts.push("- User preferences and constraints");
    parts.push("");
    parts.push("Conversation:");
    for (const m of messages) {
      const head = m.tool_call_id ? `[tool:${m.name ?? m.tool_call_id}]` : `[${m.role}]`;
      parts.push(`${head} ${m.content}`);
    }
    return parts.join("\n");
  }

  private async collectResponse(
    messages: Message[],
    opts: SummarizeOpts,
  ): Promise<{ text: string; in: number; out: number; costUsd?: number }> {
    const stream = this.provider.complete(messages, {
      model: this.model,
      maxTokens: opts.maxOutputTokens ?? 500,
      signal: opts.signal,
    });
    let text = "";
    let inTokens = 0;
    let outTokens = 0;
    let costUsd: number | undefined;
    for await (const chunk of stream) {
      const c = chunk as StreamChunk;
      if (c.type === "token") text += c.text;
      else if (c.type === "done") {
        inTokens = c.usage.in;
        outTokens = c.usage.out;
        costUsd = c.usage.costUsd;
      }
    }
    return { text, in: inTokens, out: outTokens, costUsd };
  }
}

export class BtwChannel {
  private readonly provider: Provider;
  private readonly model: string;

  constructor(provider: Provider, model: string) {
    this.provider = provider;
    this.model = model;
  }

  async ask(question: string, opts: BtwOpts = {}): Promise<BtwResult> {
    const messages: Message[] = [
      { role: "system", content: "Answer the user's question concisely. Use the provided context if relevant, but do not modify or respond to the main conversation." },
    ];
    if (opts.context && opts.context.length > 0) {
      for (const m of opts.context) {
        messages.push({ role: m.role as "user" | "assistant" | "system", content: m.content });
      }
    }
    messages.push({ role: "user", content: question });

    const stream = this.provider.complete(messages, {
      model: this.model,
      maxTokens: 1024,
      signal: opts.signal,
    });
    let text = "";
    let inTokens = 0;
    let outTokens = 0;
    let costUsd: number | undefined;
    for await (const chunk of stream) {
      const c = chunk as StreamChunk;
      if (c.type === "token") text += c.text;
      else if (c.type === "done") {
        inTokens = c.usage.in;
        outTokens = c.usage.out;
        costUsd = c.usage.costUsd;
      }
    }
    return {
      question,
      answer: text,
      tokensUsed: inTokens + outTokens,
      costUsd,
    };
  }
}
