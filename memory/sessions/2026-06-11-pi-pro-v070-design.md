# 2026-06-11 ~01:30 — pi-pro v0.7.0 design + project rename

**Trigger:** Sid: "alr go, and also the name is changed to pi-pro its not promyra buddy"

## Phase 1 — Project rename

Sid corrected the project name: "pi-pro" (not "promyra"). All references reverted.

**Bulk sed:**
- `@promyra/` → `@pi/` in all source files
- `promyra` → `pi-pro` in all source files
- Excluded: `dist/`, `coverage/`, `.promyra/checkpoints/`, `node_modules/`, `.git/`

**Directory rename:**
- `apps/promyra/` → `apps/pi-pro/` via `git mv`
- `apps/pi-pro/package.json` updated: `name: "pi-pro"`, `description` updated
- Binary name `pi` preserved (only the project dir is renamed)

**Identifier bug from sed:**
- `pi-proPath` parsed by TS as `pi - proPath` (subtraction)
- Fixed: `pi-proPath` → `piProPath` in `packages/provider/test/config.test.ts` and any other source

**GitHub repo rename:**
- `DNDED/promyra` → `DNDED/pi-pro` via `PATCH /repos/DNDED/promyra` with `{"name": "pi-pro"}`
- Old URL auto-redirects to new
- Local `git remote set-url origin https://github.com/DNDED/pi-pro.git`

**Memory rename:**
- `memory/projects/promyra.md` → `memory/projects/pi-pro.md`
- Updated `memory/README.md` (project name + decisions list)
- Updated `memory/daily/2026-06-11.md` (Phase 6 v0.6.0 finish + Phase 7 rename)

**Verification:**
- 774/774 tests pass (was 868; -94 from deleted `apps/promyra/` duplicates)
- `pnpm -r typecheck` clean
- All 14 packages build clean

## Phase 2 — v0.7.0 Memory at Scale brainstorm

**Decisions (in order):**
1. **Scope:** Ambitious — sliding window + extractive + LLM-summarize + cross-session memory + codebase index + /btw + auto-summarization
2. **Embeddings:** Provider API (Anthropic Voyage-3, OpenAI text-embedding-3-small, opencode-go); NullEmbeddings BM25 fallback
3. **Storage:** Global SQLite (`~/.pi-pro/memory.db`) + per-project markdown
4. **Compression:** Hybrid — extractive first (drop oldest 50% tool results, then 30% non-system messages), LLM-summarize only if still over budget
5. **Codebase index:** Both — regex symbols (v0.5.0 repo-map) + embeddings (semantic)
6. **Auto-summarization:** Adaptive — token threshold (75% soft-warn, 90% hard), turn count (every 20), cost cap (default $0.50/session). OR logic.

**Additional decisions:**
- No sqlite-vss for v0.7.0 (brute-force cosine for <10k chunks; add vss in v0.8.0 if scale demands)
- `/btw` = side-question channel, separate LLM call, never enters main history
- TUI ContextBudget = live bar in Footer (green/yellow/red)
- Live LLM bench still deferred (no API key in this env); mocked bench stubs in tests

## Phase 3 — v0.7.0 spec + plan

- `docs/superpowers/specs/2026-06-11-pi-pro-v0.7.0-design.md` (12 sections, ~300 lines)
- `docs/superpowers/plans/2026-06-11-pi-pro-v0.7.0.md` (9 tasks, dependency-driven build order)

**Build order:**
1. `packages/embeddings` — provider abstraction + 4 impls
2. `packages/memory-store` — SQLite + hybrid search
3. `packages/context-manager` — sliding window + extractive + adaptive triggers + /btw
4. `packages/codebase-index` — regex + embeddings + watcher
5. Wire into `LlmWorker`
6. TUI ContextBudget + BtwPrompt + /context
7. CLI flags + commands
8. Bench: long-task fixture + attribution configs
9. Final verify + commit + push

## Phase 4 — Memory updates (this session)

- `memory/projects/pi-pro.md` — added v0.7.0 in-progress + rename note
- `memory/decisions/v0.7.0.md` — 9 new decisions
- `memory/sessions/index.md` — added v0.7.0-design row
- `memory/README.md` — updated decisions list + project name
- `memory/daily/2026-06-11.md` — added Phase 6 (v0.6.0 finish) and Phase 7 (rename + v0.7.0 design)

## Outcome / verification

- 774/774 tests pass
- `pnpm -r typecheck` clean
- All 14 packages build clean
- Spec + plan written; v0.7.0 build begins with Task 1 (packages/embeddings)

**Vault links:** [[../projects/pi-pro]] (v0.7.0 added), [[../decisions/v0.7.0]].
