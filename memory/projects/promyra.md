---
type: project
status: active
repo: /home/trader/pi-pro (was: /home/trader/Developer/pi-pro — symlink-equivalent)
---

# promyra

Sid's improved coding agent — TypeScript fork of [pi-mono](https://github.com/earendil-works/pi) (Mario Zechner's minimal coding agent). Position: beat Claude Code and OpenCode on the same model via cost optimization, agent swarm, and better telemetry.

## Why this exists

- `pi-mono` upstream is intentionally minimal (4 tools, no MCP, no plan mode, no sub-agents) and Mario's "fork it" stance invites derivatives.
- `oh-my-pi` (can1357) is the most popular battery-included fork but heavy on Rust+TS hybrid.
- `Dicklesworthstone/pi_agent_rust` is the Rust port.
- promyra is Sid's take: keep the minimal TS surface, layer v0.5.0 Token/Cost Foundation on top, then v0.6.0 Agent Swarm. Target: "same model, lower cost, more reliable on complex tasks."

## Architecture

```
apps/pi (CLI, single LlmWorker)
  └─ @promyra/subagent (LlmWorker + SubagentRouter + role-based tools)
       ├─ @promyra/optimizer (central decision point: cache, cascade, cost)
       │    └─ @promyra/cache (PromptCache + ToolResultCache)
       │    └─ pricing + cascade routing
       ├─ @promyra/repo-map (regex symbol scanner; tree-sitter lazy)
       ├─ @promyra/provider (4 providers: anthropic, openai, opencode-go, openrouter/ollama)
       ├─ @promyra/tools (read/write/edit/grep/glob/bash/webfetch)
       └─ @promyra/tui-pro (Ink TUI; Footer with cost + cache line)
```

v0.6.0 adds:
```
       └─ @promyra/swarm (orchestrator + 5 subagents + scratchpad + verification + budget)
            └─ planner / researcher / builder / critic / test-runner
            └─ .promyra/swarm/<id>/  (file scratchpad)
            └─ .promyra/worktrees/<id>/<role>/  (per-role git worktrees)
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
- **PROMYRA_* env flags** — `PROMYRA_CACHE=0`, `PROMYRA_REPO_MAP=0`, `PROMYRA_CASCADE=0`, `PROMYRA_PARALLEL_TOOLS=0`, `PROMYRA_TELEMETRY=0`. All default ON. `apps/pi/src/flags.ts` reads at startup.
- **Bench attribution** — `bench/src/attribution.ts` runs 6 flag configs (all-on, all-off, cache-off, cascade-off, parallel-off, repomap-off) and reports per-technique cost/wall/pass deltas.

Test count: **749 / 749 passing** (was 635 in v0.4.0; +114 new). All 14 packages build clean. Full `pnpm -r typecheck` clean.

### v0.6.0 Agent Swarm v1 — IN DESIGN (this session)

Targets vs v0.5.0:
- **Pass rate:** ≥ v0.5.0 + 15pp
- **Cost:** ≤ 1.5x of v0.5.0
- **Wall:** ≤ 1.8x of v0.5.0
- **Reliability:** hard cap on retries, deterministic cost ceiling

Decisions (this session):
- **Scope:** Full swarm — orchestrator + planner + builder + critic + test-runner + researcher + worktrees + verification + cost caps + retry
- **Autonomy:** Fully autonomous, plan on demand. `pi swarm "<goal>"` runs; `--plan` shows plan first.
- **Worktrees:** Per-role worktrees, isolated writes. Builder + test-runner get git worktrees; planner/researcher/critic read cwd.
- **Failure handling:** Retry-with-feedback (default 2 retries), then escalate to user.
- **Cost cap:** Soft warn at 50%, hard kill at 100%. Default $2.00 per swarm. Configurable `--budget=<usd>`.
- **Model routing:** Both — per-subagent model pinning (cheap for read-only, main for builder) AND per-tool cascade inside each subagent (v0.5.0 cascade map).
- **Communication:** File-based scratchpad at `.promyra/swarm/<id>/` (durable, diffable, survives restarts).
- **CLI:** `pi swarm`, `--plan`, `--budget`, `--max-retries`, `--dry-run`, `--continue <id>`, `--status <id>`, `--merge <id>`, `--list`. Multica preserved as one-shot direct dispatch.

### Roadmap (future)

| Release | Theme |
|---|---|
| v0.7.0 | Memory at Scale — sliding window + semantic compression, cross-session persistent memory, codebase index, context budget UI. Addresses OpenCode's #1 user complaint (long-session memory leaks). |
| v0.8.0 | UX Differentiation — `/btw`, `/context` visualization, vim motions, clickable links, web session viewer, per-turn cost display. |
| v0.9.0 | Nested subagents (the thing Claude Code forbids), OS-level sandboxing (bubblewrap/Seatbelt), plugin marketplace, local SWE-bench-lite runner. |

## Bench state (v0.4.0 → v0.5.0)

Per `docs/agent-comparison-v0.4.md` (v0.4.0): 6/8 task parity with opencode on same model. Cost telemetry was 0% one-shot pass on the LLM bench. v0.5.0 target: same parity, ≤50% cost. **Live LLM bench deferred to a follow-up session with API key configured.**

## Files of interest

- `docs/superpowers/specs/2026-06-11-promyra-v0.5.0-design.md` — v0.5.0 full spec
- `docs/superpowers/plans/2026-06-11-promyra-v0.5.0.md` — v0.5.0 implementation plan
- `docs/superpowers/specs/2026-06-11-promyra-v0.6.0-design.md` — v0.6.0 full spec (this session)
- `docs/superpowers/plans/2026-06-11-promyra-v0.6.0.md` — v0.6.0 implementation plan (this session)
- `CHANGELOG.md` — release log
- `bench/src/attribution.ts` — `runAttribution(provider, opts, configs)` + `formatAttribution(report)`
- `apps/pi/src/commands/swarm.ts` — existing v0.4.0 parallel-dispatch swarm (will be wrapped by orchestrator in v0.6.0)
- `memory/` — in-repo memory system (this session)

## Build conventions

- pnpm workspaces, `packages/*` + `apps/*` + `bench/`
- All packages: `tsc -p tsconfig.json` for build, `vitest run` for tests, `tsc -p tsconfig.test.json` for typecheck
- TDD discipline: tests written first, commit per feature
- `tsconfig.test.json` must have `rootDir: "."` (not `"src"`) for `include: ["src", "test"]` to work — fixed across all packages that had the broken default
- Provider types `CacheHints` / `Usage.cacheReadTokens` / `Usage.cacheWriteTokens` / `Usage.costUsd?` are the public surface for v0.5.0
- Swarm types: see `packages/swarm/src/types.ts` (this session)
