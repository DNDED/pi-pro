# AGENTS.md — pi-pro (pi-pro)

This file is loaded by OpenCode when working in `/home/trader/Developer/pi-pro`. It overrides the global `~/.config/opencode/AGENTS.md` for this project.

## Project

- **Name:** pi-pro
- **Type:** TypeScript fork of [pi-mono](https://github.com/earendil-works/pi) (Mario Zechner's minimal coding agent)
- **Goal:** beat Claude Code and OpenCode on the same model via cost optimization, agent swarm, and better telemetry
- **Repo:** `/home/trader/Developer/pi-pro`
- **See:** `memory/projects/pi-pro.md` for full state, releases, architecture, files of interest

## Memory (in-repo, not Obsidian)

Memory for this project lives in `memory/` at the repo root — not in the global Obsidian vault. The Obsidian vault is for other projects (leadops, argent, etc.).

- **Auto-recall (5 files at session start):** `memory/user.md`, `memory/projects/pi-pro.md`, `memory/decisions/v0.6.0.md` (+ `v0.5.0.md`), `memory/daily/YYYY-MM-DD.md`, `memory/sessions/index.md`
- **Auto-store:** write durable facts immediately as they emerge (preferences → `user.md`; project state → `projects/pi-pro.md`; decisions → `decisions/v0.X.md`; narrative → `daily/YYYY-MM-DD.md`; task logs → `sessions/`)
- **Session end checklist:** 5-step gate before the final reply of any task
- **Full rules:** `memory/AGENTS-rules.md` (HARD GATEs)

## Workflow gates (HARD — fail closed)

These gates mirror the global `~/.config/opencode/AGENTS.md` but are repeated here for project-context:

1. **Memory Auto-Recall** — read 5 files at session start. No questions before reading.
2. **Memory Auto-Store** — write durable facts immediately. No waiting for Sid.
3. **Session End Checklist** — walk 5 steps before the final reply of any task.
4. **Project Auto-Detection** — if path is rooted in pi-pro, load `memory/projects/pi-pro.md` first.
5. **Brainstorming** — for new features, behavior changes, or "improve this" with no spec, brainstorm first. Spec → plan → build. Tuning known things and pure Q&A skip.
6. **TDD** — write tests first, then implement minimal to pass, then refactor.
7. **Conciseness** — no preamble, no postamble, no filler, no emojis.
8. **No-Commit** — no commits/pushes/PRs without explicit ask. "ok build" = execute, not commit.

## Stack

- pnpm workspaces (`packages/*` + `apps/*` + `bench/`)
- TypeScript + Node 20+
- vitest for tests, `tsc` for typecheck/build
- Ink + React for TUI
- All packages: `tsc -p tsconfig.json` for build, `vitest run` for tests, `tsc -p tsconfig.test.json` for typecheck

## Build conventions

- `tsconfig.test.json` must have `rootDir: "."` (not `"src"`) for `include: ["src", "test"]` to work
- TDD discipline: tests first, commit per feature
- No comments in code unless Sid asks
- No emojis in any output (including memory files, code, comments)

## Quick reference

- `pnpm -r test` — run all tests (target: 800+ passing)
- `pnpm -r typecheck` — typecheck all packages (target: clean)
- `pnpm -r build` — build all packages (target: 15+ clean)
- `pnpm --filter @pi/bench bench` — run the LLM bench
- `pnpm --filter @pi/bench bench --attribution` — run per-flag attribution (v0.5.0+)
- `pi swarm "<goal>"` — run a v0.6.0 agent swarm (when shipped)
- `pi swarm --plan "<goal>"` — show plan + roster first
- `pi swarm --budget=<usd> "<goal>"` — override cost cap
- `pi multica <name> "<task>"` — direct dispatch to a single subagent (Multica preserved from v0.4.0)
- `pi /btw <question>` — side question (v0.7.0+)
- `pi /context` — show context budget breakdown (v0.7.0+)

## Env flags (v0.5.0+)

- `PROMYRA_CACHE=0` — disable prompt cache
- `PROMYRA_REPO_MAP=0` — disable repo map
- `PROMYRA_CASCADE=0` — disable cascade routing
- `PROMYRA_PARALLEL_TOOLS=0` — disable parallel tool execution
- `PROMYRA_TELEMETRY=0` — disable cost telemetry

All default ON.

## Env flags (v0.7.0+)

- `PROMYRA_EMBEDDINGS=openai|anthropic|opencode-go|null` — override embeddings provider
- `PROMYRA_COMPRESSION=extractive|llm|off` — compression strategy
- `PROMYRA_MEMORY_QUERY_K=20` — memory chunks to inject per turn
- `PROMYRA_SOFT_WARN=0.75` — soft-warn threshold (75% of context)
- `PROMYRA_HARD_TRIGGER=0.90` — hard-trigger threshold (90% of context)

All default ON.

## Env flags (v0.8.4+)

- `PROMYRA_NERD_FONTS=0|1|true|false` — override Nerd Font detection
- `PI_HOME_OVERRIDE=<path>` — override ~/.pi/ for config/auth/memory
- `PI_MODEL=<model>` — override provider.model (one-off, not persisted)
- `PI_AGENT=<agent>` — override agent.name (one-off, not persisted)
- `PI_BASE_URL=<url>` — override provider.baseUrl (one-off, not persisted)
- `XDG_CONFIG_HOME=<path>` — override config dir (XDG-aware)

## Config (v0.8.4+)

Persistent config at `~/.pi/pi.json` (XDG-aware). Schema version 1.

```json
{
  "version": 1,
  "provider": { "name": "opencode-go", "model": "minimax-m3" },
  "agent":    { "name": "build", "maxIterations": 10, "toolBudget": 6 },
  "theme":    { "name": "default" },
  "swarm":    { "defaultBudgetUsd": 2.00, "defaultRetries": 1 },
  "context":  { "embeddings": "openai", "compression": "hybrid", "memoryQueryK": 20 },
  "ui": {
    "editor": true, "statusLine": true, "copyFriendly": false, "nerdFonts": true,
    "icons": {}, "colors": {}, "gitStatusIntervalMs": 5000
  },
  "modes": [
    { "name": "build", "label": "BUILD", "color": "success", "activeTools": ["read","write","edit","bash","grep","glob","find","ls","webfetch"], "readOnly": false },
    { "name": "plan",  "label": "PLAN",  "color": "warning", "activeTools": ["read","bash","grep","find","ls","questionnaire"], "readOnly": true }
  ]
}
```

CLI:
- `pi config show` / `set <key> <value>` / `unset <key>` / `reset` / `path`
- `pi mode [show|list|cycle|set <name>]`
- `pi plan [toggle|on|off]`
- `pi ui [show|copy-friendly|statusline|nerdfonts]`
- `pi todos [show|clear]`

Bindings:
- **Tab** in any input mode → cycle to next agent mode
- `/mode` command — explicit mode change
- `Ctrl+P` — explicit mode picker (planned v0.8.5)
