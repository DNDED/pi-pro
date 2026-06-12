import { Provider } from "@promyra/provider";
import { StepContext, SubagentResult, Tool } from "./types.js";
import { LlmWorker, ToolInstance } from "./llm-worker.js";

export interface PipelineStage {
  name: string;
  role: string;
  model: string;
  maxTools: number;
  maxIterations?: number;
  allowedTools?: Tool[];
  systemPromptExtra?: string;
}

export interface PipelineResult extends SubagentResult {
  stages: Array<{ name: string; status: string; tokensIn: number; tokensOut: number; durationMs: number }>;
  qualityScore?: number;
  reviewIssues?: string[];
}

const DEFAULT_STAGES: Record<string, PipelineStage> = {
  analyze: {
    name: "analyze",
    role: "build",
    model: "minimax-m3",
    maxTools: 4,
    maxIterations: 3,
    allowedTools: ["read", "grep", "glob"],
    systemPromptExtra: [
      "## Stage: ANALYZE",
      "Your ONLY job is to understand the codebase. DO NOT write or edit any code.",
      "Read the relevant files. Understand the patterns. Find the problem.",
      "When you understand the problem fully, emit: {\"status\":\"pass\",\"evidence\":\"<what you found>\"}",
    ].join("\n"),
  },
  plan: {
    name: "plan",
    role: "build",
    model: "minimax-m3",
    maxTools: 3,
    maxIterations: 2,
    allowedTools: ["read", "grep", "glob"],
    systemPromptExtra: [
      "## Stage: PLAN",
      "Based on the analysis, write a step-by-step plan. DO NOT write code yet.",
      "List: files to modify, changes to make, verification steps.",
      "Emit {\"status\":\"pass\",\"evidence\":\"<your plan>\"} when ready.",
    ].join("\n"),
  },
  execute: {
    name: "execute",
    role: "build",
    model: "minimax-m3",
    maxTools: 8,
    maxIterations: 12,
    systemPromptExtra: [
      "## Stage: EXECUTE",
      "Now implement the plan. Use tools to read, edit, and test.",
      "Run the test command after each change.",
      "Emit {\"status\":\"pass\",\"evidence\":\"<what you did>\"} when tests pass.",
    ].join("\n"),
  },
  review: {
    name: "review",
    role: "code-reviewer",
    model: "minimax-m3",
    maxTools: 2,
    maxIterations: 2,
    allowedTools: ["read", "grep", "glob"],
    systemPromptExtra: [
      "## Stage: REVIEW",
      "Review the code changes and score each dimension 0-5:",
      "1. Idiomatic patterns — follows language conventions, proper async/try-catch",
      "2. Efficiency — uses correct data structures, avoids O(n²)",
      "3. Safety — no injection, no silent failures, proper error handling",
      "4. Maintainability — single responsibility, good naming, modular",
      "5. Edge cases — handles null, empty, boundary, unexpected inputs",
      "",
      "Emit ONE of:",
      "{\"status\":\"pass\",\"evidence\":\"Score: 25/25 — all dimensions excellent\"}",
      "{\"status\":\"fail\",\"evidence\":\"Score: X/25 — issues: ...\"}",
    ].join("\n"),
  },
  refine: {
    name: "refine",
    role: "build",
    model: "minimax-m3",
    maxTools: 6,
    maxIterations: 8,
    systemPromptExtra: [
      "## Stage: REFINE",
      "The code review found issues. Fix them now.",
      "Only fix the specific issues mentioned. Don't change anything else.",
      "Run the test command to verify your fixes.",
      "Emit {\"status\":\"pass\",\"evidence\":\"<fixed what you changed>\"} when tests pass.",
    ].join("\n"),
  },
};

export class PipelineWorker {
  private readonly qualityThreshold: number;

  constructor(
    private readonly provider: Provider,
    private readonly tools: ToolInstance[],
    private readonly workdir: string,
    private readonly stages: Record<string, PipelineStage>,
    private readonly modelMap: Record<string, string> = {},
    private readonly opts: { qualityThreshold?: number; maxRefineLoops?: number } = {},
  ) {
    this.qualityThreshold = opts.qualityThreshold ?? 20;
  }

  static default(
    provider: Provider,
    tools: ToolInstance[],
    workdir: string,
    modelMap: Record<string, string> = {},
    opts: { qualityThreshold?: number; maxRefineLoops?: number } = {},
  ): PipelineWorker {
    return new PipelineWorker(provider, tools, workdir, DEFAULT_STAGES, modelMap, opts);
  }

  private effectiveModel(stageName: string, fallback: string): string {
    return this.modelMap[stageName] || fallback;
  }

  async run(context: StepContext): Promise<PipelineResult> {
    const stageResults: PipelineResult["stages"] = [];
    let tokensIn = 0, tokensOut = 0;

    const analyzeStage = this.stages.analyze ?? DEFAULT_STAGES.analyze;
    const analyzeResult = await this.runStage(analyzeStage, context, null);
    stageResults.push({ name: "analyze", status: analyzeResult.status, tokensIn: analyzeResult.tokensIn, tokensOut: analyzeResult.tokensOut, durationMs: analyzeResult.durationMs });
    tokensIn += analyzeResult.tokensIn; tokensOut += analyzeResult.tokensOut;

    const planStage = this.stages.plan ?? DEFAULT_STAGES.plan;
    const planContext = { ...context, description: `${context.description}\n\nAnalysis from previous stage:\n${analyzeResult.evidence}` };
    const planResult = await this.runStage(planStage, planContext, null);
    stageResults.push({ name: "plan", status: planResult.status, tokensIn: planResult.tokensIn, tokensOut: planResult.tokensOut, durationMs: planResult.durationMs });
    tokensIn += planResult.tokensIn; tokensOut += planResult.tokensOut;

    const executeStage = this.stages.execute ?? DEFAULT_STAGES.execute;
    const executeContext = { ...context, description: `${context.description}\n\nAnalysis:\n${analyzeResult.evidence}\n\nPlan:\n${planResult.evidence}` };
    const executeResult = await this.runStage(executeStage, executeContext, null);
    stageResults.push({ name: "execute", status: executeResult.status, tokensIn: executeResult.tokensIn, tokensOut: executeResult.tokensOut, durationMs: executeResult.durationMs });
    tokensIn += executeResult.tokensIn; tokensOut += executeResult.tokensOut;

    let maxRefineLoops = this.opts.maxRefineLoops ?? 2;
    let currentStatus = executeResult;
    let currentEvidence = executeResult.evidence;

    // Auto-refine loop: keep improving until quality passes or max loops
    for (let refineCount = 0; refineCount < maxRefineLoops; refineCount++) {
      // Run review
      const reviewStage = this.stages.review ?? DEFAULT_STAGES.review;
      const reviewContext = {
        ...context,
        description: [
          "Review the code changes for the task:",
          context.description,
          "",
          "Current implementation evidence:",
          currentEvidence,
        ].join("\n"),
      };
      
      const reviewResult = await this.runStage(reviewStage, reviewContext, null);
      stageResults.push({
        name: refineCount === 0 ? "review" : `review-${refineCount + 1}`,
        status: reviewResult.status,
        tokensIn: reviewResult.tokensIn,
        tokensOut: reviewResult.tokensOut,
        durationMs: reviewResult.durationMs,
      });
      tokensIn += reviewResult.tokensIn;
      tokensOut += reviewResult.tokensOut;

      // Parse quality score from review evidence
      const scoreMatch = reviewResult.evidence.match(/Score:\s*(\d+)\/25/i);
      const qualityScore = scoreMatch ? parseInt(scoreMatch[1]) : reviewResult.status === "pass" ? 25 : 15;

      // Accept if quality passes threshold
      if (qualityScore >= this.qualityThreshold) {
        return {
          ...currentStatus,
          stages: stageResults,
          qualityScore,
          tokensIn, tokensOut,
          durationMs: stageResults.reduce((s, r) => s + r.durationMs, 0),
        };
      }

      // Quality too low — refine and retry
      if (refineCount < maxRefineLoops - 1) {
        const refineStage = this.stages.refine ?? DEFAULT_STAGES.refine;
        const refineContext = {
          ...context,
          description: [
            "The code review found issues. Quality score: " + qualityScore + "/25 (threshold: " + this.qualityThreshold + "/25).",
            "",
            "Issues identified:",
            reviewResult.evidence,
            "",
            "Fix ALL the issues. Make the code more idiomatic, efficient, safe, maintainable.",
            "Focus especially on dimensions that scored below 4/5.",
          ].join("\n"),
        };

        const refineResult = await this.runStage(refineStage, refineContext, null);
        stageResults.push({
          name: refineCount === 0 ? "refine" : `refine-${refineCount + 1}`,
          status: refineResult.status,
          tokensIn: refineResult.tokensIn,
          tokensOut: refineResult.tokensOut,
          durationMs: refineResult.durationMs,
        });
        tokensIn += refineResult.tokensIn;
        tokensOut += refineResult.tokensOut;

        currentStatus = refineResult;
        currentEvidence = refineResult.evidence;
      }
    }

    // Max loops exhausted — return what we have
    return {
      ...currentStatus,
      stages: stageResults,
      qualityScore: 15,
      tokensIn, tokensOut,
      durationMs: stageResults.reduce((s, r) => s + r.durationMs, 0),
    };
  }

  private async runStage(stage: PipelineStage, context: StepContext, priorContext: string | null): Promise<SubagentResult> {
    const allowedTools = stage.allowedTools
      ? this.tools.filter(t => stage.allowedTools!.includes(t.name as Tool))
      : this.tools;

    const worker = new LlmWorker(this.provider, allowedTools, this.workdir, {
      maxIterations: stage.maxIterations ?? 12,
      model: this.effectiveModel(stage.name, stage.model),
      toolBudget: stage.maxTools,
      systemPromptPrefix: stage.systemPromptExtra ?? undefined,
    });

    const description = priorContext
      ? `${context.description}\n\n${priorContext}`
      : context.description;

    return worker.run(stage.role, {
      taskId: context.taskId,
      stepId: `${context.stepId}-${stage.name}`,
      description,
      worktreePath: context.worktreePath,
      diff: context.diff,
    });
  }
}
