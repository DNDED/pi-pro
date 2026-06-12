---
type: project
status: active
repo: /home/trader/Developer/pi-pro
---

# pi-pro

Sid's improved coding agent — **ships as a pi-mono extension**, not a separate binary.

**GitHub:** DNDED/pi-pro (re-init clean; previous v0.5.0–v0.8.4 history wiped per Sid)
**Local:** `/home/trader/Developer/pi-pro` (master, fresh git init)
**Runtime install:** `pi install ./packages/pi-pro-ext` → registers in `~/.pi/agent/settings.json`

## Why a pi-mono extension

Per Sid: *"it should just be an extension of this pi agent: pi.dev — dont make a brand new one"*.

- pi-mono v0.79.x is upstream (Mario Zechner's official)
- pi-pro layers on top via the documented ExtensionAPI
- User installs pi once (via curl https://pi.dev/install.sh) and adds our extension
- No competing binary, no PATH hacks, no symlink maintenance

## Architecture (v0.1.0)

```
pi-mono v0.79.x (oficial @earendil-works/pi-coding-agent)
  └─ pi CLI (npm-global bin)
       └─ ~/.pi/agent/extensions/pi-pro-ext/  ← our package
            └─ packages/pi-pro-ext/index.ts     ExtensionAPI wiring (jiti-loadable, no compile)
                 └─ uses @pi-pro/config          PiConfig schema
```

## What's in the monorepo

```
pi-pro/
├── packages/
│   ├── pi-pro-ext/                THE EXTENSION (shipped)
│   │   ├── package.json           pi-package manifest
│   │   └── index.ts               ExtensionAPI wiring
│   └── config/                    @pi-pro/config (PiConfig schema)
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.test.json
│       ├── vitest.config.ts
│       ├── src/                   types, paths, load, save, merge, modes
│       └── test/
├── memory/                         in-repo memory
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── .gitignore
```

## Features in v0.2.0 (in progress)

- `:mode` command — show/cycle/set agent mode (build ↔ plan)
- `:plan` command — toggle plan mode (read-only)
- `todo` tool — LLM-callable todo state (list/add/toggle/clear)
- `:todos` command — show todo list
- `:config` command — show pi-pro config
- `:doctor` command — system check
- `Tab` shortcut in editor — cycle agent mode
- Plan mode: DESTRUCTIVE_PATTERNS bash gate + tool allowlist
- **Starship-style footer** via `ctx.ui.setStatus` (cwd + branch + git icons + runtime + mode)
- **Plan widget** via `ctx.ui.setWidget` (parses `Plan:` headers + `[DONE:n]` markers)
- **Memory store** — file-based JSONL at `~/.pi/pi-pro/memory.jsonl`, commands: `/memory-add`, `/memory-list`, `/memory-search`, `/memory-clear`
- **Runtime detection** — 26+ languages, format via `formatRuntime(runtime)`
- **Git status parser** — porcelain parse, Nerd Font icons (or ASCII fallback)
- `/btw` — side question
- `/context` — context budget breakdown
- Config: `~/.pi/pi.json` (provider/agent/theme/ui/modes)

## Releases

### v0.2.0 — full feature parity as extension (in progress, 2026-06-12)

- 91 tests pass (27 config + 64 extension)
- Typecheck clean
- pi loads the extension without errors (verified via `pi -e ./packages/pi-pro-ext --print`)
- Index.ts wired with: footer, plan widget, memory ops, runtime/git detection, agent mode cycle, Tab shortcut, todo tool, all REPL commands
- Cast `(ctx.ui as { setStatus?: ... }).setStatus?.(...)` — TypeBox doesn't expose ctx.ui's full API

### v0.1.0 — clean reinstall (2026-06-12)

- Hard wipe: nuked old 19-package monorepo, re-init from scratch
- pi-mono v0.79.1 installed via oficial curl installer
- pi-pro ships as a single-file extension
- TDD: 100% test coverage on @pi-pro/config
- 27 tests pass

## Deferred

- LSP, web viewer, plugin system, nested subagents — future
- Live LLM bench — needs Go subscription activation at opencode.ai/auth
- Telegram adapter — v0.2.0 candidate

## Build conventions

- pnpm workspaces, `packages/*`
- TypeScript strict
- Extension file: `.ts`, jiti-loadable (no compile step needed)
- Internal packages: standard TS → tsc → dist
- Tests: vitest
- TDD discipline
- `AGENTS.md` is HARD GATE source
