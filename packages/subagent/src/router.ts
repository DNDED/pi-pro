import { Role, StepContext, SubagentResult, SubagentResultSchema, Worker } from "./types.js";
import { allowedTools } from "./tool-restrictions.js";
import { promptFor, StubWorker } from "./worker.js";
import { LlmWorker, ToolInstance } from "./llm-worker.js";
import {
  createBashTool, createEditTool, createGlobTool, createGrepTool, createReadTool, createWebfetchTool, createWriteTool,
} from "@pi/tools";
import type { Provider } from "@pi/provider";

const RETRY_LIMIT = 2;

export class SubagentRouter {
  constructor(private readonly worker: Worker = new StubWorker()) {}

  static withProvider(provider: Provider, workdir: string): SubagentRouter {
    const allTools: ToolInstance[] = [
      createBashTool({ cwd: workdir }) as unknown as ToolInstance,
      createReadTool({ cwd: workdir }) as unknown as ToolInstance,
      createWriteTool({ cwd: workdir }) as unknown as ToolInstance,
      createEditTool({ cwd: workdir }) as unknown as ToolInstance,
      createGrepTool({ cwd: workdir }) as unknown as ToolInstance,
      createGlobTool({ cwd: workdir }) as unknown as ToolInstance,
      createWebfetchTool() as unknown as ToolInstance,
    ];
    const llm = new LlmWorker(provider, allTools, workdir);
    return new SubagentRouter(llm);
  }

  async dispatch(role: Role, context: StepContext): Promise<SubagentResult> {
    const prompt = promptFor(role, context);
    const tools = allowedTools(role);
    if (tools.length === 0) {
      throw new Error(`Role ${role} has no allowed tools — invalid configuration`);
    }

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
      try {
        const result = await this.worker.run(role, context, prompt);
        return SubagentResultSchema.parse(result);
      } catch (err) {
        lastError = err;
        if (attempt === RETRY_LIMIT) break;
      }
    }

    return {
      role,
      stepId: context.stepId,
      status: "blocked",
      evidence: `Router failed after ${RETRY_LIMIT} attempts: ${(lastError as Error)?.message ?? "unknown"}`,
      tokensIn: prompt.length,
      tokensOut: 0,
      durationMs: 0,
    };
  }
}

export { StubWorker, promptFor } from "./worker.js";
export { allowedTools, isAllowed } from "./tool-restrictions.js";
export { RoleSchema, StepContextSchema, SubagentResultSchema } from "./types.js";
export type { Role, StepContext, SubagentResult, Tool, Worker } from "./types.js";
