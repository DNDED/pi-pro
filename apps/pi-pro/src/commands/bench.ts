import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenCodeGoProvider, loadConfig, getApiKey } from "@pi/provider";
import { LlmBenchRunner } from "@pi/bench";
import type { BenchSummary } from "@pi/bench";

export async function benchCommand(opts: { parallel?: boolean; concurrency?: string } = {}): Promise<void> {
  const apiKey = await getApiKey("opencode-go");
  if (!apiKey) {
    console.error("pi-pro bench: no OpenCode Go API key configured.");
    console.error("Set OPENCODE_GO_API_KEY env var or run: pi-pro config set apiKey <key>");
    process.exit(1);
  }
  const cfg = await loadConfig();
  const provider = new OpenCodeGoProvider({ apiKey, model: cfg.model });
  const workdir = await mkdtemp(join(tmpdir(), "pi-pro-bench-"));
  try {
    const runner = new LlmBenchRunner(provider, { workspaceRoot: workdir, model: cfg.model });
    const concurrency = opts.concurrency ? parseInt(opts.concurrency, 10) : undefined;
    const summary = opts.parallel
      ? await runner.runAllParallel(undefined, concurrency)
      : await runner.runAll();
    printSummary(summary);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function printSummary(summary: BenchSummary): void {
  console.log(`\n=== pi-pro LLM bench ===\n`);
  for (const r of summary.results) {
    const status = r.completed ? "✓" : r.skipped ? "~" : "✗";
    console.log(`  ${status} ${r.taskId.padEnd(20)} ${r.fixture.padEnd(15)} ${r.testCommand}`);
    if (r.skipped) console.log(`     skipped: ${r.skipReason}`);
    if (r.error && !r.skipped) console.log(`     error: ${r.error}`);
  }
  const rate = summary.total === 0 ? 0 : (summary.completed / summary.total) * 100;
  const effective = summary.total - summary.skipped;
  const effRate = effective === 0 ? 0 : (summary.completed / effective) * 100;
  console.log(`\nResult: ${summary.completed}/${summary.total} one-shot (${rate.toFixed(0)}% raw, ${effRate.toFixed(0)}% excluding skipped)`);
  console.log(`Skipped: ${summary.skipped} (missing local toolchain)`);
  console.log(`Tokens: in=${summary.tokensIn}, out=${summary.tokensOut}`);
  console.log(`Wall:   ${(summary.wallMs / 1000).toFixed(1)}s`);
}
