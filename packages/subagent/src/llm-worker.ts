import { Provider, Message, CallOpts, Tool as ProviderTool, StreamChunk } from "@pi/provider";
import { StepContext, SubagentResult, Tool } from "./types.js";
import { buildRoleSystemPrompt } from "./role-prompt.js";

export interface ToolInstance {
  name: Tool;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export interface LlmWorkerOpts {
  maxIterations?: number;
  systemPromptPrefix?: string;
  model?: string;
  toolBudget?: number;
  toolBudgets?: Partial<Record<string, number>>;
}

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_TOOL_BUDGET = 6;
const DEFAULT_PER_ROLE_TOOL_BUDGETS: Record<string, number> = {
  "build": 8,
  "test-runner": 1,
  "code-reviewer": 0,
  "security-auditor": 4,
};

const JSON_STATUS_RE = /\{[\s\S]*?"status"\s*:\s*"(pass|fail|blocked)"[\s\S]*?\}/;

export class LlmWorker {
  private readonly maxIterations: number;
  private readonly systemPromptPrefix: string;
  private readonly model: string | undefined;
  private readonly toolMap: Map<string, ToolInstance>;
  private readonly toolList: ProviderTool[];
  private readonly toolBudget: number | undefined;
  private readonly toolBudgets: Partial<Record<string, number>>;

  constructor(
    private readonly provider: Provider,
    tools: ToolInstance[],
    private readonly workdir: string,
    opts: LlmWorkerOpts = {},
  ) {
    this.maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.systemPromptPrefix = opts.systemPromptPrefix ?? "";
    this.model = opts.model;
    this.toolBudget = opts.toolBudget;
    this.toolBudgets = opts.toolBudgets ?? {};
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.toolList = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as unknown as Record<string, unknown>,
    }));
  }

  async run(role: string, context: StepContext): Promise<SubagentResult> {
    const start = Date.now();
    const roleDefault = DEFAULT_PER_ROLE_TOOL_BUDGETS[role];
    const effectiveBudget = this.toolBudgets?.[role]
      ?? this.toolBudget
      ?? (roleDefault !== undefined ? roleDefault : DEFAULT_TOOL_BUDGET);
    const messages: Message[] = [
      { role: "system", content: this.systemPrompt(role) },
      { role: "user", content: this.userPrompt(role, context) },
    ];
    const opts: CallOpts = {
      model: this.model ?? "",
      tools: this.toolList,
    };

    let lastText = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let cumulativeTools = 0;

    for (let i = 0; i < this.maxIterations; i++) {
      const stream = this.provider.complete(messages, opts);
      const toolCalls: Array<{ id: string; name: string; args: unknown }> = [];
      let doneSeen = false;

      for await (const chunk of stream) {
        if (chunk.type === "token") {
          lastText += chunk.text;
        } else if (chunk.type === "tool_call") {
          toolCalls.push({ id: chunk.id, name: chunk.name, args: chunk.args });
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
        messages.push({ role: "assistant", content: [{ type: "text", text: lastText || "..." }, ...toolCalls.map(tc => ({ type: "tool_use" as const, id: tc.id, name: tc.name, input: tc.args }))] });
        // Anthropic Messages API requires tool results to come back as
        // a `user` message containing `tool_result` content blocks (one
        // per `tool_use`). The OpenAI "role: tool" wire format is not
        // accepted by Anthropic-compatible endpoints (e.g. MiniMax
        // returns "tool call result does not follow tool call" if you
        // send `role: tool` after a `tool_use`).
        const toolResultBlocks: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }> = [];
        for (const tc of toolCalls) {
          const tool = this.toolMap.get(tc.name);
          if (!tool) {
            toolResultBlocks.push({ type: "tool_result", tool_use_id: tc.id, content: `Tool "${tc.name}" is not allowed for role "${role}".`, is_error: true });
            continue;
          }
          try {
            const result = await tool.execute((tc.args ?? {}) as Record<string, unknown>);
            const resultStr = typeof result === "string" ? result : JSON.stringify(result);
            toolResultBlocks.push({ type: "tool_result", tool_use_id: tc.id, content: resultStr.slice(0, 8000) });
          } catch (e) {
            toolResultBlocks.push({ type: "tool_result", tool_use_id: tc.id, content: `Error: ${(e as Error).message}`, is_error: true });
          }
        }
        messages.push({ role: "user", content: toolResultBlocks });
        cumulativeTools += toolCalls.length;
        lastText = "";

        if (cumulativeTools >= effectiveBudget * 2) {
          return {
            role: role as never,
            stepId: context.stepId,
            status: "blocked",
            evidence: `Exceeded tool budget (${cumulativeTools} tool calls) without producing a status.`,
            tokensIn, tokensOut,
            durationMs: Date.now() - start,
          };
        }

        if (cumulativeTools >= effectiveBudget) {
          messages.push({
            role: "user",
            content: `You have used ${cumulativeTools} tools. If you have enough information to judge pass/fail/blocked, emit the final status JSON now (e.g. {"status":"pass","evidence":"..."}). If you need more tools, continue — but be concise.`,
          });
        }

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

  private systemPrompt(role: string): string {
    const base = [
      this.systemPromptPrefix,
      "",
      "## Critical: how to finish",
      "",
      "After you have used the tools to complete (or attempt) the work, you MUST stop calling tools and respond with EXACTLY this JSON object, on its own, with no other text:",
      "",
      '{"status": "pass"|"fail"|"blocked", "evidence": "<one-line summary of what you did>"}',
      "",
      "Status semantics:",
      '  - "pass":    work is complete, all relevant tests/verification pass',
      '  - "fail":    you could not complete the work (compilation error, test failure, missing dep)',
      '  - "blocked": you do not have enough info / a tool you need is missing',
      "",
      "Do NOT call any more tools after you have enough information to judge pass/fail/blocked. Do NOT explain your reasoning. Do NOT use markdown. Just the JSON object, exactly as shown above, on a single line.",
    ].filter(Boolean).join("\n");
    return buildRoleSystemPrompt(role, base);
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
