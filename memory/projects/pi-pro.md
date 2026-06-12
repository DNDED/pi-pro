---
type: project
status: active
repo: /home/trader/Developer/pi-pro
---

# pi-pro

Sid's improved coding agent — TypeScript fork of [pi-mono](https://github.com/earendil-works/pi) (Mario Zechner's minimal coding agent). Position: beat Claude Code and OpenCode on the same model via cost optimization, agent swarm, better telemetry, and persistent memory.

**GitHub:** [DNDED/pi-pro](https://github.com/DNDED/pi-pro) (public, created 2026-06-11, renamed from `promyra` 2026-06-11)
**Owner:** [DNDED](https://github.com/DNDED) on GitHub
**Local:** `/home/trader/Developer/pi-pro` (master branch, tracks `origin/master`)
**Binary:** `pi` (cli in `apps/pi-pro/`)

## Why this exists

- `pi-mono` upstream is intentionally minimal (4 tools, no MCP, no plan mode, no sub-agents) and Mario's "fork it" stance invites derivatives.
- `oh-my-pi` (can1357) is the most popular battery-included fork but heavy on Rust+TS hybrid.
- `Dicklesworthstone/pi_agent_rust` is the Rust port.
- pi-pro is Sid's take: keep the minimal TS surface, layer v0.5.0 Token/Cost Foundation, v0.6.0 Agent Swarm, then v0.7.0 Memory at Scale. Target: "same model, lower cost, more reliable on long-horizon tasks."

## Architecture

```
apps/pi-pro (CLI)
  └─ @pi/subagent (LlmWorker + SubagentRouter + role-based tools)
       ├─ @pi/optimizer (central decision point: cache, cascade, cost)
       │    └─ @pi/cache (PromptCache + ToolResultCache)
       │    └─ pricing + cascade routing
       ├─ @pi/repo-map (regex symbol scanner; tree-sitter lazy)
       ├─ @pi/provider (4 providers: anthropic, openai, opencode-go, openrouter/ollama)
       ├─ @pi/tools (read/write/edit/grep/glob/bash/webfetch)
       └─ @pi/tui-pro (Ink TUI; Footer with cost + cache line)
       └─ @pi/swarm (v0.6.0: orchestrator + 5 subagents + scratchpad + worktree + budget)
            └─ planner / researcher / builder / critic / test-runner
            └─ .pi-pro/swarm/<id>/  (file scratchpad)
            └─ .pi-pro/worktrees/<id>/<role>/  (per-role git worktrees)
```

v0.7.0 adds:
```
       └─ @pi/context-manager (sliding window + extractive + LLM-summarize + /btw + adaptive triggers)
            └─ @pi/memory-store (SQLite-backed chunk store + hybrid search)
            └─ @pi/embeddings (provider abstraction: anthropic/openai/opencode-go/null)
            └─ @pi/codebase-index (regex symbols + embeddings + hybrid search)
            └─ TUI ContextBudget + BtwPrompt + /context command
```

## Releases

### v0.5.0 Token/Cost Foundation — SHIPPED 2026-06-11

Targets on the 5-task bench (same model as v0.4.0):
- **Cost:** ≤ 50% of v0.4.0
- **Quality:** ≥ 95% of v0.4.0 pass rate (5% variance)
- **Wall:** ≤ 60% of v0.4.0 (~18s avg)

Stack:
- **Prompt caching** via Anthropic `cache_control: ephemeral` + OpenAI `prompt_cache_key`. Wired in all 3 providers.
- **Tool result cache** (256-entry LRU, mtime invalidation, file-invalidated on edit/write).
- **Cascade routing** — per-tool hardcoded: Haiku-class for grep/glob/read, main for edit/write/bash.
- **Static block assembly** (system + repo-map + tools) with cache breakpoints.
- **Parallel tool execution** via `Promise.all` in the LLM worker.
- **Cost telemetry** — TUI `Footer` shows `tok:1.4k↗/380↘ | $0.012 | cache:74% | 12:34`. `formatCostBreakdown()` for `/cost` command.
- **Repo map** — regex-based symbol scanner (TS/Py/Go/Rust/Ruby), 1024-token budget, query-relevance ranking. No tree-sitter native dep.
- **PROMYRA_* env flags** — `PROMYRA_CACHE=0`, `PROMYRA_REPO_MAP=0`, `PROMYRA_CASCADE=0`, `PROMYRA_PARALLEL_TOOLS=0`, `PROMYRA_TELEMETRY=0`. All default ON. `apps/pi-pro/src/flags.ts` reads at startup.
- **Bench attribution** — `bench/src/attribution.ts` runs 6 flag configs (all-on, all-off, cache-off, cascade-off, parallel-off, repomap-off) and reports per-technique cost/wall/pass deltas.

Test count: **749 / 749 passing** (was 635 in v0.4.0; +114 new). All 14 packages build clean. Full `pnpm -r typecheck` clean.

### v0.6.0 Agent Swarm v1 — SHIPPED 2026-06-11

Targets vs v0.5.0:
- **Pass rate:** ≥ v0.5.0 + 15pp
- **Cost:** ≤ 1.5x of v0.5.0
- **Wall:** ≤ 1.8x of v0.5.0
- **Reliability:** hard cap on retries, deterministic cost ceiling

Stack:
- **`@pi/swarm`** (NEW) — orchestrator + 5 subagents + scratchpad + worktree-pool + budget + verification + plan-writer + merge + optimizer-integration. 102 tests.
- **7-phase state machine:** PLAN → RESEARCH+PLANNER (parallel) → BUILD w/ retry → TEST → CRITIQUE → DECIDE → MERGE
- **File scratchpad** at `.pi-pro/swarm/<id>/` (durable, diffable, survives restarts)
- **Per-role git worktrees** for builder + test-runner; read-only subagents operate on cwd
- **Soft-warn at 50%, hard-kill at 100%** per-swarm budget; default $2.00; `--budget=<usd>` override
- **Retry-with-feedback** (builder=2, test-runner=1, others=0) before subagent-failed pause
- **Both** subagent pinning (cheap for read-only, main for builder) **AND** per-tool cascade (v0.5.0 cascade map)
- **CLI:** `pi swarm`, `--plan`, `--budget`, `--max-retries`, `--dry-run`, `--continue <id>`, `--status <id>`, `--merge <id>`, `--list`. Multica preserved as one-shot direct dispatch.
- **TUI:** `<SwarmPanel>` live status with per-subagent rows + budget color states.

Test count: **868 / 868 passing** (was 749; +119 new). All 14 packages build clean. Committed + pushed to https://github.com/DNDED/pi-pro.

### v0.7.0 Memory at Scale — IN PROGRESS (this session)

Targets vs v0.6.0:
- **Long-session completion:** ≥ 90% of v0.6.0 short-session quality on 50+ turn bench
- **Token growth:** bounded; auto-compress at 90% of context window
- **Memory leak:** ≤ 50MB RSS after 100 turns
- **Cross-session recall:** ≥ 80% on injected-context test
- **Codebase search accuracy:** ≥ 70% top-5 hit rate

Stack (in build order):
1. **`@pi/embeddings`** (NEW) — provider abstraction + Anthropic Voyage-3 + OpenAI text-embedding-3-small + opencode-go + NullEmbeddings BM25 fallback
2. **`@pi/memory-store`** (NEW) — SQLite-backed chunk store with hybrid cosine+BM25 search
3. **`@pi/context-manager`** (NEW) — sliding window + extractive compression + adaptive triggers + /btw
4. **`@pi/codebase-index`** (NEW) — regex symbols + embeddings + hybrid search + chokidar watcher
5. **Wire into LlmWorker** — `LlmWorker` wraps `ContextManager`; `/btw` exposed
6. **TUI** — `ContextBudget`, `BtwPrompt`, `/context` command
7. **CLI** — `--memory`, `--embeddings`, `--compression` flags; `/btw`, `/memory-*` commands
8. **Bench** — long-task fixture; attribution `compression-off/memory-off/embeddings-off`

### Roadmap (future)

| Release | Theme |
|---|---|
| v0.8.0 | UX Differentiation — vim motions, clickable links, web session viewer, per-turn cost display. |
| v0.9.0 | Nested subagents (the thing Claude Code forbids), OS-level sandboxing (bubblewrap/Seatbelt), plugin marketplace, local SWE-bench-lite runner. |

## Project rename (2026-06-11)

- Repo `DNDED/promyra` renamed → `DNDED/pi-pro` via GitHub API (`PATCH /repos/{owner}/{repo}` with `{"name": "new-name"}`).
- Bulk sed: `@promyra/` → `@pi/` and `promyra` → `pi-pro` in source/docs/memory.
- `apps/promyra/` renamed → `apps/pi-pro/` via `git mv`. Binary name `pi` preserved.
- Watched for hyphenated identifier bugs (`pi-proPath` parsed as `pi - proPath`; fixed to `piProPath`).

## Bench state (v0.4.0 → v0.5.0)

Per `docs/agent-comparison-v0.4.md` (v0.4.0): 6/8 task parity with opencode on same model. Cost telemetry was 0% one-shot pass on the LLM bench. v0.5.0 target: same parity, ≤50% cost. **Live LLM bench deferred to a follow-up session with API key configured.**

## Files of interest

- `docs/superpowers/specs/2026-06-11-pi-pro-v0.5.0-design.md` — v0.5.0 full spec
- `docs/superpowers/plans/2026-06-11-pi-pro-v0.5.0.md` — v0.5.0 implementation plan
- `docs/superpowers/specs/2026-06-11-pi-pro-v0.6.0-design.md` — v0.6.0 full spec
- `docs/superpowers/plans/2026-06-11-pi-pro-v0.6.0.md` — v0.6.0 implementation plan
- `docs/superpowers/specs/2026-06-11-pi-pro-v0.7.0-design.md` — v0.7.0 full spec
- `docs/superpowers/plans/2026-06-11-pi-pro-v0.7.0.md` — v0.7.0 implementation plan
- `CHANGELOG.md` — release log
- `bench/src/attribution.ts` — `runAttribution(provider, opts, configs)` + `formatAttribution(report)`
- `apps/pi-pro/src/commands/swarm.ts` — v0.6.0 swarm CLI wrapping `@pi/swarm/Orchestrator`
- `memory/` — in-repo memory system

## Build conventions

- pnpm workspaces, `packages/*` + `apps/*` + `bench/`
- All packages: `tsc -p tsconfig.json` for build, `vitest run` for tests, `tsc -p tsconfig.test.json` for typecheck
- TDD discipline: tests written first, commit per feature
- `tsconfig.test.json` must have `rootDir: "."` (not `"src"`) for `include: ["src", "test"]` to work — fixed across all packages that had the broken default
- Provider types `CacheHints` / `Usage.cacheReadTokens` / `Usage.cacheWriteTokens` / `Usage.costUsd?` are the public surface for v0.5.0
- Swarm types: see `packages/swarm/src/types.ts`
- v0.7.0: EmbeddingsProvider / ContextManager / CodebaseIndex types live in their respective packages
