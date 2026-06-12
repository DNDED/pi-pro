import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, getApiKey } from "@promyra/provider";
import { LlmBenchRunner } from "@promyra/bench";
import type { BenchSummary, BenchResult } from "@promyra/bench";

export interface SkipResult {
  skipped: boolean;
  reason: string;
}

export function shouldSkip(fixture: string, bootstrapResult: { bootstrapped: boolean; message?: string }): SkipResult {
  if (bootstrapResult.bootstrapped) return { skipped: false, reason: "" };
  return { skipped: true, reason: bootstrapResult.message ?? "unknown reason" };
}

export function printSummary(summary: BenchSummary): string {
  const lines: string[] = [];
  lines.push(`\n=== promyra LLM bench ===\n`);
  for (const r of summary.results) {
    const status = r.completed ? "✓" : r.skipped ? "~" : "✗";
    lines.push(`  ${status} ${r.taskId.padEnd(20)} ${r.fixture.padEnd(15)} ${r.testCommand}`);
    if (r.skipped) lines.push(`     skipped: ${r.skipReason}`);
    if (r.error && !r.skipped) lines.push(`     error: ${r.error}`);
  }
  const rate = summary.total === 0 ? 0 : (summary.completed / summary.total) * 100;
  const effective = summary.total - summary.skipped;
  const effRate = effective === 0 ? 0 : (summary.completed / effective) * 100;
  lines.push(`\nResult: ${summary.completed}/${summary.total} one-shot (${rate.toFixed(0)}% raw, ${effRate.toFixed(0)}% excluding skipped)`);
  lines.push(`Skipped: ${summary.skipped} (missing local toolchain)`);
  lines.push(`Tokens: in=${summary.tokensIn}, out=${summary.tokensOut}`);
  lines.push(`Wall:   ${(summary.wallMs / 1000).toFixed(1)}s`);
  return lines.join("\n") + "\n";
}

export function printSummaryJson(summary: BenchSummary): string {
  const results = summary.results.map(r => ({
    taskId: r.taskId,
    fixture: r.fixture,
    completed: r.completed,
    skipped: r.skipped,
    skipReason: r.skipReason,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    wallMs: r.wallMs,
    error: r.error || null,
  }));

  return JSON.stringify({
    total: summary.total,
    completed: summary.completed,
    failed: summary.failed,
    skipped: summary.skipped,
    passRate: summary.total === 0 ? 0 : (summary.completed / summary.total) * 100,
    effectiveRate: (summary.total - summary.skipped) === 0 ? 0 : (summary.completed / (summary.total - summary.skipped)) * 100,
    tokensIn: summary.tokensIn,
    tokensOut: summary.tokensOut,
    wallMs: summary.wallMs,
    wallSec: (summary.wallMs / 1000).toFixed(1),
    avgTokensPerTask: summary.total > 0 ? Math.round(summary.tokensIn / summary.total) : 0,
    avgWallPerTask: summary.total > 0 ? Math.round(summary.wallMs / summary.total) : 0,
    results,
  }, null, 2);
}

export async function benchCommand(opts: { parallel?: boolean; concurrency?: string; model?: string; json?: boolean; modelMap?: string; pipeline?: boolean } = {}): Promise<void> {
  const apiKey = await getApiKey("opencode-go");
  if (!apiKey) {
    console.error("promyra bench: no OpenCode Go API key configured.");
    console.error("Set OPENCODE_GO_API_KEY env var or run: promyra config set apiKey <key>");
    process.exit(1);
  }
  const cfg = await loadConfig();
  const model = opts.model ?? cfg.model;

  let modelMap: Record<string, string> | undefined;
  if (opts.modelMap) {
    try {
      modelMap = JSON.parse(opts.modelMap);
    } catch {
      console.error("Invalid --model-map JSON. Expected: {\"hard\":\"opencode-go/qwen3.7-max\"}");
      process.exit(1);
    }
  }

  const { createProvider } = await import("@promyra/provider");
  const provider = createProvider({ apiKey, defaultModel: model });
  const workdir = await mkdtemp(join(tmpdir(), "promyra-bench-"));
  try {
    const runner = new LlmBenchRunner(provider, { workspaceRoot: workdir, model, modelMap, usePipeline: opts.pipeline });
    const concurrency = opts.concurrency ? parseInt(opts.concurrency, 10) : undefined;
    const summary = opts.parallel
      ? await runner.runAllParallel(undefined, concurrency)
      : await runner.runAll();
    if (opts.json) {
      process.stdout.write(printSummaryJson(summary) + "\n");
    } else {
      process.stdout.write(printSummary(summary));
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
