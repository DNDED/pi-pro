---
type: project
status: active
repo: /home/trader/Developer/pi-pro
---

# pi-pro

Sid's improved coding agent — TypeScript fork of [pi-mono](https://github.com/earendil-works/pi) (Mario Zechner's minimal coding agent). Position: beat Claude Code and OpenCode on the same model via cost optimization, agent swarm, persistent memory, modal vim, and zentui-style UI.

**GitHub:** [DNDED/pi-pro](https://github.com/DNDED/pi-pro) (public, created 2026-06-11, renamed from `promyra` 2026-06-11)
**Owner:** [DNDED](https://github.com/DNDED) on GitHub
**Local:** `/home/trader/Developer/pi-pro` (master branch, tracks `origin/master`)
**Binary:** `pi` (cli in `apps/pi-pro/`)

## Why this exists

- `pi-mono` upstream is intentionally minimal (4 tools, no MCP, no plan mode, no sub-agents) and Mario's "fork it" stance invites derivatives.
- `oh-my-pi` (can1357) is the most popular battery-included fork but heavy on Rust+TS hybrid.
- `Dicklesworthstone/pi_agent_rust` is the Rust port.
- pi-pro is Sid's take: keep the minimal TS surface, layer v0.5.0 Token/Cost Foundation, v0.6.0 Agent Swarm, v0.7.0 Memory at Scale, v0.8.0 UX Differentiation, v0.8.1 Modal Vim, v0.8.4 Workflow + UI Overhaul. Target: "same model, lower cost, more reliable on long-horizon tasks."

## Architecture

```
apps/pi-pro (CLI) v0.8.4
  └─ @pi/subagent (LlmWorker + SubagentRouter + role-based tools)
       ├─ @pi/optimizer (central decision point: cache, cascade, cost)
       │    └─ @pi/cache (PromptCache + ToolResultCache)
       │    └─ pricing + cascade routing
       ├─ @pi/repo-map (regex symbol scanner; tree-sitter lazy)
       ├─ @pi/provider (4 providers: anthropic, openai, opencode-go, openrouter/ollama)
       ├─ @pi/tools (read/write/edit/grep/glob/bash/webfetch)
       ├─ @pi/tui-pro (Ink TUI; StarshipFooter, EditorFrame, modal vim, plan-mode,
       │              todo list, git-status parser, runtime detector,
       │              Nerd Font detection)
       │    └─ @pi/config (PiConfig: provider, agent, theme, swarm, context, ui, modes)
       │    └─ @pi/context-manager (sliding window + extractive + LLM-summarize + /btw)
       │         └─ @pi/memory-store (SQLite-backed chunk store + hybrid search)
       │         └─ @pi/embeddings (provider abstraction: anthropic/openai/opencode-go/null)
       │         └─ @pi/codebase-index (regex symbols + embeddings + hybrid search)
       └─ @pi/swarm (v0.6.0: orchestrator + 5 subagents + scratchpad + worktree + budget)
            └─ planner / researcher / builder / critic / test-runner
            └─ .pi-pro/swarm/<id>/  (file scratchpad)
            └─ .pi-pro/worktrees/<id>/<role>/  (per-role git worktrees)
```

## Releases

### v0.5.0 Token/Cost Foundation — SHIPPED 2026-06-11
Test count: **749 / 749 passing** (was 635 in v0.4.0; +114 new). All 14 packages build clean.

### v0.6.0 Agent Swarm v1 — SHIPPED 2026-06-11
Test count: **868 / 868 passing** (was 749; +119 new).

### v0.7.0 Memory at Scale — SHIPPED 2026-06-11
Test count: **1016 / 1016 passing** (was 868; +148 new). All 18 packages build clean.

### v0.8.0 UX Differentiation — SHIPPED 2026-06-11
Test count: **1069 / 1069 passing** (was 1016; +53 new). All 18 packages build clean.
3 atomic commits pushed.

### v0.8.1 Modal Vim — SHIPPED 2026-06-12 (CHECKPOINT)
Test count: **1130 / 1130 passing** (was 1069; +61 new). All 18 packages build clean.

### v0.8.4 Workflow + UI Overhaul — SHIPPED 2026-06-12
Targets vs v0.8.3:
- **Workflow foundation:** persistent config + agent mode cycle (Tab) + plan mode + todo list
- **UI overhaul:** zentui-style Starship footer + bordered editor + Nerd Font detection + git status icons + runtime detection

Stack (10 atomic commits):
1. `@pi/config` (NEW, 34 tests) — Zod-validated PiConfig; XDG paths; atomic writes; agent modes
2. Agent mode cycle + Tab dispatch + BUILD/PLAN badge in PromptInput (8 tests)
3. `LlmWorker.setActiveTools` + tool gate (20 tests)
4. Plan-mode extension (21 tests) — /plan, [DONE:n], progress widget, DESTRUCTIVE_PATTERNS
5. Todo extension (16 tests) — todo tool, /todos command, persistent state
6. Git status parser (15 tests) — porcelain + Nerd Font/ASCII icons
7. Runtime detection (13 tests) — 26 language markers (Node, Bun, Deno, Go, Rust, etc.)
8. zentui-style UI (20 tests) — Nerd Font detection, StarshipFooter, EditorFrame
9. CLI wiring (10 new + 7 integration tests) — config/mode/plan/todos/ui commands
10. Docs (this file + CHANGELOG + decisions + sessions)

**Test count:** **1321 / 1321 passing** (was 1160; **+161 new**, +13.9%). All 19 packages build clean.

10 atomic commits pushed. Tag v0.8.4 when Sid asks.

### Roadmap (future)

| Release | Theme |
|---|---|---|
| v0.8.5 | `--config` flag, `:set` ex commands, LSP integration (typescript-language-server), todo LLM tool wiring |
| v0.8.6 | Web session viewer (Sid's "tailscale ip") |
| v0.9.0 | Full Telegram adapter (`@pi/telegram`), plugin system (npm-installable), nested subagents (Claude Code forbids), OS-level sandboxing |
| v0.10.0 | Gondolin micro-VM, live LLM bench attribution (needs Go subscription activation) |

## Project rename (2026-06-11)

- Repo `DNDED/promyra` renamed → `DNDED/pi-pro` via GitHub API (`PATCH /repos/{owner}/{repo}` with `{"name": "new-name"}`).
- Bulk sed: `@promyra/` → `@pi/` and `promyra` → `pi-pro` in source/docs/memory.
- `apps/promyra/` renamed → `apps/pi-pro/` via `git mv`. Binary name `pi` preserved.
- Watched for hyphenated identifier bugs (`pi-proPath` parsed as `pi - proPath`; fixed to `piProPath`).

## Bench state (v0.4.0 → v0.5.0)

Per `docs/agent-comparison-v0.4.md` (v0.4.0): 6/8 task parity with opencode on same model. Cost telemetry was 0% one-shot pass on the LLM bench. v0.5.0 target: same parity, ≤50% cost. **Live LLM bench deferred to a follow-up session with API key configured.**

## Files of interest

- `docs/superpowers/specs/2026-06-12-pi-pro-v0.8.4-design.md` — v0.8.4 full spec
- `docs/superpowers/plans/2026-06-12-pi-pro-v0.8.4.md` — v0.8.4 implementation plan
- `memory/decisions/v0.8.4.md` — 13 v0.8.4 decisions
- `memory/sessions/2026-06-12-pi-pro-v084-design.md` + `v084-build.md` — design + build logs
- `CHANGELOG.md` — release log (v0.8.4 entry)
- `bench/src/attribution.ts` — `runAttribution(provider, opts, configs)` + `formatAttribution(report)`
- `apps/pi-pro/src/commands/swarm.ts` — v0.6.0 swarm CLI wrapping `@pi/swarm/Orchestrator`
- `packages/config/` — v0.8.4 new package (foundation for plugins/LSP/web viewer)
- `packages/tui-pro/src/components/StarshipFooter.tsx` + `EditorFrame.tsx` — zentui-style UI
- `memory/` — in-repo memory system

## Build conventions

- pnpm workspaces, `packages/*` + `apps/*` + `bench/`
- All packages: `tsc -p tsconfig.json` for build, `vitest run` for tests, `tsc -p tsconfig.test.json` for typecheck
- TDD discipline: tests written first, commit per feature
- `tsconfig.test.json` must have `rootDir: "."` (not `"src"`) for `include: ["src", "test"]` to work — fixed across all packages that had the broken default
- Provider types `CacheHints` / `Usage.cacheReadTokens` / `Usage.cacheWriteTokens` / `Usage.costUsd?` are the public surface for v0.5.0
- Swarm types: see `packages/swarm/src/types.ts`
- v0.7.0: EmbeddingsProvider / ContextManager / CodebaseIndex types live in their respective packages
- v0.8.0: parseLinks / LlmWorker.getLastTurnUsage / getDeltaSinceLastRun
- v0.8.1: vim.ts (VimState) + vim-dispatch.ts (VimRuntime, handleKey)
- v0.8.4: PiConfig (Zod) / AgentMode / cycleMode / gateToolCall / parsePorcelain / detectRuntime / detectNerdFonts
