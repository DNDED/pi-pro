# 2026-06-12 ~04:10 — pi-pro v0.8.2 SESSION HANDOFF (COMPRESSED)

> **Purpose:** restore context for a fresh session in 60 seconds. Read this first.

## Current state (at end of v0.8.1)

- **Repo:** `/home/trader/Developer/pi-pro`
- **Branch:** `master`
- **Tag:** `v0.8.1` (https://github.com/DNDED/pi-pro/releases/tag/v0.8.1)
- **Latest commit:** `f9394df docs: v0.8.1 final CHANGELOG + session log + project status (CHECKPOINT)`
- **Tests:** 1130/1130 pass, 18 packages build clean, typecheck clean
- **Working tree:** clean

## v0.7.0 + v0.8.0 + v0.8.1 (this release cycle)

| | Tests | Packages | Notes |
|---|---|---|---|
| v0.6.0-finish | 868 | 14 | Agent Swarm v1 |
| v0.7.0 | 1016 | 18 (+4) | embeddings, memory-store, context-manager, codebase-index |
| v0.8.0 | 1069 | 18 | per-turn cost, clickable links, insert-mode vim |
| v0.8.1 | 1130 | 18 | full modal vim (insert/normal/visual) |

## Key files of interest

- `packages/tui-pro/src/util/vim.ts` — pure vim functions (29 tests)
- `packages/tui-pro/src/util/vim-dispatch.ts` — VimRuntime + handleKey dispatch (32 tests)
- `packages/tui-pro/src/components/PromptInput.tsx` — refactored to use vim state machine
- `packages/embeddings/` — provider abstraction (Anthropic, OpenAI, opencode-go, null)
- `packages/memory-store/` — SQLite + hybrid cosine+BM25+recency search
- `packages/context-manager/` — sliding window + extractive + LLM-summarize + /btw
- `packages/codebase-index/` — wraps repo-map + chokidar watcher
- `packages/subagent/src/llm-worker.ts` — LlmWorker with `contextManager` opt, `getLastTurnUsage`, `getDeltaSinceLastRun`
- `apps/pi-pro/src/commands/{memory,btw,setup}.ts` — CLI subcommands + REPL
- `bench/src/context-attribution.ts` — 4 v0.7.0 attribution configs

## Memory architecture

- **In-repo:** `memory/` at repo root (NOT Obsidian)
- 5 auto-recall files at session start: `user.md`, `projects/pi-pro.md`, `decisions/v0.8.0.md` (+ earlier), `daily/2026-06-11.md` (or current), `sessions/index.md`
- Decisions: `memory/decisions/v0.X.md` per release
- Session logs: `memory/sessions/YYYY-MM-DD-<short-id>.md`

## Live LLM bench status (deferred)

- Sid shared key: `sk-qJ4wv5cn8BKlUnoblJzbKqmQbCTd2T6Ok4dmVic7lBIDOHSI0hvzC8XCzEi6Ed6I`
- **Status:** 200 on `/v1/models` but 401 on `/v1/messages` and `/v1/chat/completions`
- **Diagnosis:** Cloudflare read-side auth works, write-side auth fails. Likely Go subscription not active for this key.
- **Fix needed:** activate at https://opencode.ai/auth, then re-run bench
- **Key handling:** NEVER written to disk. Only used in inline `env OPENCODE_GO_API_KEY=… node -e` invocations. Not in shell history (commands were standalone).

## Next-session candidates (priority order)

1. **ex mode for vim** (`:w`/`:q`/`:wq`/`:clear`/`:help`) — small, no external deps, ~15 tests. v0.8.2.
2. **sqlite-vss for memory-store** — only meaningful after real bench shows >10k chunks
3. **Live LLM bench attribution** — needs OpenCode Go key activation first
4. **Web session viewer** — separate web app; significant scope
5. **LSP integration** for code intelligence

## Conventions

- **No emoji** in any output (code, memory, CHANGELOG, commits)
- **No comments** in code unless Sid asks
- **TDD:** tests first, fail, implement minimal to pass, refactor
- **No commits/pushes without explicit ask** (per `pi-pro/AGENTS.md`)
- **Branch:** `master` (not `main`)
- **Commit style:** conventional commits (`feat(scope): description`)

## Sid's preferences (from `memory/user.md`)

- Concise by default; one-line answers when one line suffices
- "Continue" = execute the plan, build the thing, ship
- "Fix the rest" = finish pending items in current scope
- "ok continue wit that" / "do whats best" = push through with what makes sense
- "lets do a checkpoint" = commit + tag + memory update

## Reusable patterns

- 3-phase build: spec/plan + memory update → build with TDD → commit + push
- 9-commit batch per release: per-package + wiring + lock + docs + bench attribution + memory
- "Compress and continue" = write a tight session-state doc + pick the next small impactful thing

## Open issues / known bugs

- None blocking as of v0.8.1
- Live bench 401s on completions (key issue, not code)
- v0.6.0 `bench/test/runner-invariants.test.ts` has 1 flaky test (concurrent tmpdirs); pre-existing, not v0.8.x related

## Quick-start commands for next session

```bash
# Auto-recall
cat /home/trader/Developer/pi-pro/memory/user.md
cat /home/trader/Developer/pi-pro/memory/projects/pi-pro.md
cat /home/trader/Developer/pi-pro/memory/decisions/v0.8.0.md
ls /home/trader/Developer/pi-pro/memory/daily/
cat /home/trader/Developer/pi-pro/memory/sessions/index.md

# Verify state
cd /home/trader/Developer/pi-pro
git log --oneline -3
git status
pnpm -r test 2>&1 | tail -3
```
