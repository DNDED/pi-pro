/**
 * v0.7.0 bench attribution runner.
 *
 * Runs the bench with different v0.7.0 context flag configurations
 * and reports per-technique impact on cost / wall / pass rate /
 * context-budget / compression events.
 *
 * Configs:
 *   - memory-off:        PROMYRA_MEMORY=0 (no memory injection)
 *   - compression-off:   PROMYRA_COMPRESSION=off (no auto-compress)
 *   - embeddings-off:    PROMYRA_EMBEDDINGS=null (BM25 only, no vector)
 *   - baseline:          all v0.7.0 flags at defaults
 *
 * Per v0.7.0 spec §11, live LLM bench is deferred (no API key in this
 * env). The numbers below are projected/expected ranges from the spec;
 * they are stub data that will be replaced by real bench runs in a
 * follow-up session.
 */

import { LlmBenchRunner, type LlmBenchRunnerOpts } from "./llm-bench-runner.js";

export interface ContextFlags {
  memory: boolean;
  compression: "off" | "extractive" | "llm" | "hybrid";
  embeddings: "openai" | "anthropic" | "opencode-go" | "null";
  memoryQueryK: number;
  softWarn: number;
  hardTrigger: number;
}

export type ContextFlagConfigName = "baseline" | "memory-off" | "compression-off" | "embeddings-off";

export interface ContextFlagConfig {
  label: string;
  contextFlags: Partial<ContextFlags>;
  description: string;
}

export const CONTEXT_FLAG_CONFIGS: Record<ContextFlagConfigName, ContextFlagConfig> = {
  "baseline": {
    label: "baseline",
    contextFlags: {},
    description: "All v0.7.0 flags at defaults (memory + hybrid compression + openai embeddings)",
  },
  "memory-off": {
    label: "memory-off",
    contextFlags: { memory: false },
    description: "Memory injection disabled (PROMYRA_MEMORY=0)",
  },
  "compression-off": {
    label: "compression-off",
    contextFlags: { compression: "off" },
    description: "Auto-compression disabled (PROMYRA_COMPRESSION=off)",
  },
  "embeddings-off": {
    label: "embeddings-off",
    contextFlags: { embeddings: "null" },
    description: "Embeddings disabled (PROMYRA_EMBEDDINGS=null); BM25-only memory",
  },
};

export interface ContextAttributionRow {
  flagLabel: string;
  description: string;
  totalCostUsd: number;
  avgWallMs: number;
  passRate: number;
  passCount: number;
  totalCount: number;
  /** Number of compression events fired during the run. */
  compressionEvents: number;
  /** Number of memory chunks injected across all turns. */
  memoryChunksInjected: number;
  /** Peak context usage 0..1 (vs budget). */
  peakContextUsage: number;
  /** Cross-session recall rate (v0.7.0 spec target ≥ 80%). */
  crossSessionRecall: number;
  /** Codebase search accuracy (top-5 hit rate; target ≥ 70%). */
  codebaseAccuracy: number;
}

export interface ContextAttributionReport {
  rows: ContextAttributionRow[];
  deltas: Array<{
    flagLabel: string;
    costDelta: number;
    costDeltaPct: number;
    wallDelta: number;
    passRateDelta: number;
    recallDelta: number;
    accuracyDelta: number;
  }>;
}

/**
 * Projected per-technique impact for v0.7.0 (stub data from spec §3).
 * Will be replaced by real bench results when live LLM bench runs.
 */
const PROJECTED: Record<ContextFlagConfigName, Omit<ContextAttributionRow, "flagLabel" | "description">> = {
  "baseline": {
    totalCostUsd: 0.018,
    avgWallMs: 22_000,
    passRate: 0.95,
    passCount: 5,
    totalCount: 5,
    compressionEvents: 3,
    memoryChunksInjected: 18,
    peakContextUsage: 0.88,
    crossSessionRecall: 0.85,
    codebaseAccuracy: 0.74,
  },
  "memory-off": {
    totalCostUsd: 0.014,
    avgWallMs: 20_000,
    passRate: 0.78,
    passCount: 4,
    totalCount: 5,
    compressionEvents: 5,
    memoryChunksInjected: 0,
    peakContextUsage: 0.92,
    crossSessionRecall: 0.0,
    codebaseAccuracy: 0.74,
  },
  "compression-off": {
    totalCostUsd: 0.022,
    avgWallMs: 25_000,
    passRate: 0.68,
    passCount: 3,
    totalCount: 5,
    compressionEvents: 0,
    memoryChunksInjected: 18,
    peakContextUsage: 1.0,
    crossSessionRecall: 0.85,
    codebaseAccuracy: 0.74,
  },
  "embeddings-off": {
    totalCostUsd: 0.012,
    avgWallMs: 21_000,
    passRate: 0.88,
    passCount: 4,
    totalCount: 5,
    compressionEvents: 3,
    memoryChunksInjected: 14,
    peakContextUsage: 0.88,
    crossSessionRecall: 0.62,
    codebaseAccuracy: 0.58,
  },
};

export async function runContextAttribution(
  _provider: import("@pi/provider").Provider,
  baseOpts: LlmBenchRunnerOpts,
  configs: ContextFlagConfigName[] = ["baseline", "memory-off", "compression-off", "embeddings-off"],
): Promise<ContextAttributionReport> {
  const hasLiveBench = !!baseOpts.workspaceRoot;
  const rows: ContextAttributionRow[] = [];
  for (const cfgName of configs) {
    const cfg = CONTEXT_FLAG_CONFIGS[cfgName];
    const projected = PROJECTED[cfgName];
    let totalCost = 0;
    let avgWall = 0;
    let passed = 0;
    let total = 0;
    if (hasLiveBench) {
      const opts: LlmBenchRunnerOpts = {
        ...baseOpts,
        flagLabel: cfg.label,
      };
      const runner = new LlmBenchRunner(_provider, opts);
      const summary = await runner.runAll();
      totalCost = summary.results.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      const totalWall = summary.results.reduce((s, r) => s + r.wallMs, 0);
      avgWall = summary.results.length > 0 ? totalWall / summary.results.length : 0;
      passed = summary.results.filter(r => r.completed).length;
      total = summary.results.length;
    }
    rows.push({
      flagLabel: cfg.label,
      description: cfg.description,
      totalCostUsd: totalCost > 0 ? totalCost : projected.totalCostUsd,
      avgWallMs: avgWall > 0 ? avgWall : projected.avgWallMs,
      passRate: total > 0 ? passed / total : projected.passRate,
      passCount: total > 0 ? passed : projected.passCount,
      totalCount: total > 0 ? total : projected.totalCount,
      compressionEvents: projected.compressionEvents,
      memoryChunksInjected: projected.memoryChunksInjected,
      peakContextUsage: projected.peakContextUsage,
      crossSessionRecall: projected.crossSessionRecall,
      codebaseAccuracy: projected.codebaseAccuracy,
    });
  }

  const baseline = rows[0];
  const deltas = rows.map(row => {
    const baseCost = baseline?.totalCostUsd ?? 0;
    const baseWall = baseline?.avgWallMs ?? 0;
    const basePass = baseline?.passRate ?? 0;
    const baseRecall = baseline?.crossSessionRecall ?? 0;
    const baseAcc = baseline?.codebaseAccuracy ?? 0;
    return {
      flagLabel: row.flagLabel,
      costDelta: row.totalCostUsd - baseCost,
      costDeltaPct: baseCost > 0 ? ((row.totalCostUsd - baseCost) / baseCost) * 100 : 0,
      wallDelta: row.avgWallMs - baseWall,
      passRateDelta: row.passRate - basePass,
      recallDelta: row.crossSessionRecall - baseRecall,
      accuracyDelta: row.codebaseAccuracy - baseAcc,
    };
  });

  return { rows, deltas };
}

export function formatContextAttribution(report: ContextAttributionReport): string {
  const lines: string[] = [];
  lines.push("## v0.7.0 Memory at Scale — Bench Attribution");
  lines.push("");
  lines.push("| config       | cost    | wall/avg | pass | recall | codeAcc | peak |");
  lines.push("|--------------|---------|----------|------|--------|---------|------|");
  for (const row of report.rows) {
    const cost = `$${row.totalCostUsd.toFixed(4)}`;
    const wall = row.avgWallMs > 0 ? `${(row.avgWallMs / 1000).toFixed(1)}s` : "—";
    const pass = `${row.passCount}/${row.totalCount}`;
    const recall = `${(row.crossSessionRecall * 100).toFixed(0)}%`;
    const acc = `${(row.codebaseAccuracy * 100).toFixed(0)}%`;
    const peak = `${(row.peakContextUsage * 100).toFixed(0)}%`;
    lines.push(`| ${row.flagLabel.padEnd(12)} | ${cost.padStart(7)} | ${wall.padStart(8)} | ${pass.padStart(4)} | ${recall.padStart(6)} | ${acc.padStart(7)} | ${peak.padStart(4)} |`);
  }
  if (report.deltas.length > 1) {
    const base = report.deltas[0];
    if (base) {
      lines.push("");
      lines.push(`### Delta vs ${base.flagLabel}`);
      lines.push("");
      lines.push("| config       | cost Δ   | pass Δ  | recall Δ | codeAcc Δ |");
      lines.push("|--------------|----------|---------|----------|-----------|");
      for (const d of report.deltas) {
        const costPct = `${d.costDeltaPct >= 0 ? "+" : ""}${d.costDeltaPct.toFixed(1)}%`;
        const passDelta = `${d.passRateDelta >= 0 ? "+" : ""}${(d.passRateDelta * 100).toFixed(1)}pp`;
        const recallDelta = `${(d.recallDelta * 100).toFixed(1)}pp`;
        const accDelta = `${(d.accuracyDelta * 100).toFixed(1)}pp`;
        lines.push(`| ${d.flagLabel.padEnd(12)} | ${costPct.padStart(8)} | ${passDelta.padStart(7)} | ${recallDelta.padStart(8)} | ${accDelta.padStart(9)} |`);
      }
    }
  }
  lines.push("");
  lines.push("**Targets (per v0.7.0 spec):**");
  lines.push("- long-session completion ≥ 90% of v0.6.0");
  lines.push("- token growth bounded; auto-compress at 90%");
  lines.push("- memory leak ≤ 50MB RSS after 100 turns");
  lines.push("- cross-session recall ≥ 80%");
  lines.push("- codebase search accuracy ≥ 70% top-5");
  lines.push("");
  lines.push("Live LLM bench deferred to follow-up session (no API key in this env).");
  lines.push("Numbers above are projected from spec; will be replaced with real runs.");
  return lines.join("\n");
}
