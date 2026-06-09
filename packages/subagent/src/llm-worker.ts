import { Provider, Message, CallOpts, Tool as ProviderTool, StreamChunk } from "@pi/provider";
import { StepContext, SubagentResult, Tool } from "./types.js";

export interface ToolInstance {
  name: Tool;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export interface LlmWorkerOpts {
  maxIterations?: number;
  systemPromptPrefix?: string;
}

const DEFAULT_MAX_ITERATIONS = 10;

const JSON_STATUS_RE = /\{[\s\S]*?"status"\s*:\s*"(pass|fail|blocked)"[\s\S]*?\}/;

export class LlmWorker {
  private readonly maxIterations: number;
  private readonly systemPromptPrefix: string;
  private readonly toolMap: Map<string, ToolInstance>;
  private readonly toolList: ProviderTool[];

  constructor(
    private readonly provider: Provider,
    tools: ToolInstance[],
    private readonly workdir: string,
    opts: LlmWorkerOpts = {},
  ) {
    this.maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.systemPromptPrefix = opts.systemPromptPrefix ?? "";
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.toolList = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as unknown as Record<string, unknown>,
    }));
  }

  async run(role: string, context: StepContext): Promise<SubagentResult> {
    const start = Date.now();
    const messages: Message[] = [
      { role: "system", content: this.systemPrompt() },
      { role: "user", content: this.userPrompt(role, context) },
    ];
    const opts: CallOpts = {
      model: "",
      tools: this.toolList,
    };

    let lastText = "";
    let tokensIn = 0;
    let tokensOut = 0;

    for (let i = 0; i < this.maxIterations; i++) {
      const stream = this.provider.complete(messages, opts);
      const toolCalls: Array<{ name: string; args: unknown }> = [];
      let doneSeen = false;

      for await (const chunk of stream) {
        if (chunk.type === "token") {
          lastText += chunk.text;
        } else if (chunk.type === "tool_call") {
          toolCalls.push({ name: chunk.name, args: chunk.args });
        } else if (chunk.type === "done") {
          tokensIn += chunk.usage.in;
          tokensOut += chunk.usage.out;
          doneSeen = true;
        }
      }
      if (!doneSeen) {
        return {
          role: role as never,
          stepId: context.stepId,
          status: "blocked",
          evidence: `Provider stream ended without a done chunk after iteration ${i + 1}.`,
          tokensIn, tokensOut,
          durationMs: Date.now() - start,
        };
      }

      const statusMatch = lastText.match(JSON_STATUS_RE);
      if (statusMatch && toolCalls.length === 0) {
        return this.parseResult(role, context, lastText, tokensIn, tokensOut, start);
      }

      if (toolCalls.length > 0) {
        messages.push({ role: "assistant", content: [{ type: "text", text: lastText || "..." }, ...toolCalls.map((tc, idx) => ({ type: "tool_use" as const, id: `tc_${i}_${idx}`, name: tc.name, input: tc.args }))] });
        for (let idx = 0; idx < toolCalls.length; idx++) {
          const tc = toolCalls[idx];
          const tool = this.toolMap.get(tc.name);
          if (!tool) {
            messages.push({ role: "tool", tool_call_id: `tc_${i}_${idx}`, content: `Tool "${tc.name}" is not allowed for role "${role}".` });
            continue;
          }
          try {
            const result = await tool.execute((tc.args ?? {}) as Record<string, unknown>);
            const resultStr = typeof result === "string" ? result : JSON.stringify(result);
            messages.push({ role: "tool", tool_call_id: `tc_${i}_${idx}`, content: resultStr.slice(0, 8000) });
          } catch (e) {
            messages.push({ role: "tool", tool_call_id: `tc_${i}_${idx}`, content: `Error: ${(e as Error).message}` });
          }
        }
        lastText = "";
        continue;
      }

      return this.parseResult(role, context, lastText, tokensIn, tokensOut, start);
    }

    return {
      role: role as never,
      stepId: context.stepId,
      status: "blocked",
      evidence: `Exceeded maxIterations (${this.maxIterations}) without producing a JSON status.`,
      tokensIn, tokensOut,
      durationMs: Date.now() - start,
    };
  }

  private systemPrompt(): string {
    return [
      this.systemPromptPrefix,
      "",
      "When you have finished, your final response MUST be a JSON object of the form:",
      '{"status": "pass"|"fail"|"blocked", "evidence": "<short string>"}',
      "Do not include any text before or after the JSON. Just the JSON object, on its own line(s).",
    ].filter(Boolean).join("\n");
  }

  private userPrompt(role: string, ctx: StepContext): string {
    return [
      `Role: ${role}`,
      `Task: ${ctx.taskId}`,
      `Step: ${ctx.stepId}`,
      `Working dir: ${ctx.worktreePath ?? "(none)"}`,
      "",
      "Goal:",
      ctx.description,
      ctx.diff ? `\nDiff under review:\n\`\`\`\n${ctx.diff}\n\`\`\`` : "",
      "",
      "You have access to the tools listed in your function schema. Use them.",
      "When done, respond with a single JSON object as instructed above.",
    ].join("\n");
  }

  private parseResult(role: string, context: StepContext, text: string, tokensIn: number, tokensOut: number, start: number): SubagentResult {
    const match = text.match(JSON_STATUS_RE);
    if (!match) {
      return {
        role: role as never,
        stepId: context.stepId,
        status: "blocked",
        evidence: `No JSON status found in final response. Last text: ${text.slice(0, 200)}`,
        tokensIn, tokensOut,
        durationMs: Date.now() - start,
      };
    }
    try {
      const parsed = JSON.parse(match[0]) as { status: "pass" | "fail" | "blocked"; evidence?: string };
      return {
        role: role as never,
        stepId: context.stepId,
        status: parsed.status,
        evidence: parsed.evidence ?? "",
        tokensIn, tokensOut,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      return {
        role: role as never,
        stepId: context.stepId,
        status: "blocked",
        evidence: `JSON parse error: ${(e as Error).message}. Match: ${match[0].slice(0, 200)}`,
        tokensIn, tokensOut,
        durationMs: Date.now() - start,
      };
    }
  }
}
