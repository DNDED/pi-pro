# 2026-06-11 ~23:30 — promyra v0.5.0 finish-the-rest

**Trigger:** Sid: "fix the rest" (4 pending v0.5.0 items after the prior build session).

**Files touched (v0.5.0 finish):**
- `packages/repo-map/` (NEW) — src/extract.ts, src/repo-map.ts, src/types.ts, src/index.ts, 2 test files, package.json, tsconfig*.json, vitest.config.ts
- `packages/tui-pro/src/cost-display.ts` (NEW) — CostTracker + formatStatusLine + formatCostBreakdown
- `packages/tui-pro/src/components/Footer.tsx` — extended with cost/cache/elapsed props
- `packages/tui-pro/src/index.ts` — re-exports
- `packages/tui-pro/test/cost-display.test.ts` (NEW, 12 tests)
- `bench/src/llm-bench-runner.ts` — added costUsd/cacheHits/flagLabel to BenchResult, flags + useRepoMap opts
- `bench/src/attribution.ts` (NEW) — FLAG_CONFIGS, runAttribution, formatAttribution
- `bench/test/attribution.test.ts` (NEW, 5 tests)
- `bench/package.json` — added @promyra/cache, @promyra/optimizer, @promyra/repo-map
- `apps/pi/src/flags.ts` (NEW)
- `apps/pi/test/flags.test.ts` (NEW, 9 tests)
- `apps/pi/package.json` — added @promyra/optimizer
- `packages/subagent/src/router.ts` — readFlagsFromEnv() + flag-aware Optimizer/ToolResultCache wiring
- `CHANGELOG.md` — v0.5.0 entry (full)

**Pre-existing typecheck fixes (housekeeping):**
- 9 packages had `rootDir: "src"` in `tsconfig.test.json` incompatible with `include: ["src", "test"]` — changed to `rootDir: "."`. Packages: provider, cache, optimizer, subagent, tools, tasks, checkpoint, memory, skill-bundle.
- `provider/test/config.test.ts` — 11 `globalThis as { __cfg: ... }` casts → `globalThis as unknown as { __cfg: ... } as any`.
- `subagent/test/llm-worker.test.ts` — 10 `tool_call` chunks missing `id` field → added.
- `subagent/test/tool-restrictions.test.ts` — 1 Record type mismatch (missing `planner`/`researcher` keys) → cast to Record<string, Record<string, boolean>>.

**Decisions:**
- Repo-map: regex-based symbol scanner over tree-sitter (avoids native dep, matches spec's "graceful degrade" path). Languages: TS/JS, Python, Go, Rust, Ruby. Lazy build, per-file try/catch skip on parse error.
- Bench attribution: 6 flag configs chosen for full cross-coverage (1 baseline-on, 1 baseline-off, 4 targeted "off-one" configs).
- PROMYRA_* flag names match the spec exactly. Default ON; off = "0" / "false" / "no" / "off" (case-insensitive).
- LlmWorker `parallelTools` flag defaults to true; per-technique attribution flips it via `LlmWorkerOpts.parallelTools: false` in the optimizer flag wiring.

**Outcome / verification:**
- 749 / 749 tests passing (was 703; +46 new this turn)
- `pnpm -r typecheck`: clean
- `pnpm -r build`: all 14 packages clean
- Live LLM bench deferred (requires API key)

**Vault links:** [[../projects/promyra]], [[../../../Daily/2026-06-11]] Phase 2.
