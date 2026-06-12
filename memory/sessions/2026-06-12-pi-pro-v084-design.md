---
type: session
date: 2026-06-12
title: pi-pro v0.8.4 "Workflow + UI Overhaul" — design
status: completed
---

# v0.8.4 Design Session

**Date:** 2026-06-12
**Outcome:** v0.8.4 plan approved by Sid

## Sid's requests (verbatim)

> "ok what is teh next version that we have to improve upon"
>
> "add this too @llblab/pi-telegram ... https://pi.dev/packages/pi-zentui?type=theme"
>
> Tab cycles agent modes (like OpenCode) — "when i click tab it switches to plan and build, like when im in build it switches to tab, and when im in tab it switches to build like it cycles through like opencode you can add more modes if u want"
>
> "Full Bundle (Recommended)" for scope
>
> "Full Telegram adapter (Recommended)" for v0.9.0

## Exploration: pi.dev/packages

Fetched https://pi.dev/packages and analyzed 50+ top packages.

**Key findings:**
- pi-mono is intentionally minimal — explicitly skips sub-agents, plan mode, permission popups, MCP, todos, background bash
- 3,905 packages; 13k-131k downloads/mo for top entries
- Top patterns: subagents (pi-subagents 103k/mo), memory (pi-hermes-memory), plan mode (gentle-pi, zero-pi), todos (rpiv-todo 51k/mo), LSP (pi-lens), context compression (context-mode 131k/mo), web access (pi-web-access 91k/mo), status bars (pi-bar, pi-powerline-footer, zentui), MCP (pi-mcp-adapter 99k/mo), web UI (ygncode/pi-web, plannotator)
- pi-main has official `examples/extensions/plan-mode/` and `examples/extensions/todo.ts` with extension API
- pi-telegram: full Telegram adapter (bot setup, polling, queue, streaming HTML, voice, lock)
- pi-zentui: Starship-style footer + Opencode-style TUI

## What pi-pro already has (no need to add)

- v0.5.0 cost optimization → context-mode is similar but ours is more aggressive
- v0.6.0 swarm → pi-subagents similar but ours is custom orchestrator
- v0.7.0 memory → pi-hermes-memory 368 tests similar but ours is SQLite+embeddings+cross-session
- v0.7.0 /btw → already has it
- v0.8.0 clickable links → already has it
- v0.8.1 modal vim → already has it
- v0.8.2 :w/:q/:wq → already has it
- v0.8.3 ex mode UI → already has it

## What pi-pro is missing that the ecosystem has

- **Plan mode** — high-leverage gap
- **Todo list** — small, big UX win
- **Web session viewer** — Sid's "tailscale ip" request
- **LSP** — pi-lens style
- **MCP** — pi-mcp-adapter
- **Sandbox** — gondolin
- **Goal mode** — pi-goal style

## What Sid asked for (final)

- Plan mode (Tab cycles)
- Todo list
- UI overhaul
- Cool features
- Telegram (deferred to v0.9.0)

## Plan: v0.8.4 "Workflow + UI Overhaul" Bundle

**Big v0.8.4 = original bundle + zentui-style UI overhaul. v0.9.0 = full Telegram.**

| # | Feature | Tests |
|---|---|---|
| 1 | `@pi/config` (new pkg) | ~25 |
| 2 | Agent mode cycle (Tab) | ~12 |
| 3 | LlmWorker.setActiveTools + tool gate | (in #2) |
| 4 | Plan-mode extension | ~18 |
| 5 | Todo extension | ~15 |
| 6 | zentui-style UI (git status, runtime, Nerd Fonts, bordered editor) | ~30 |
| **Total** | | **~100** |

**Test count:** 1160 → 1266 target (actual: 1321, exceeded by 55).

## Architecture

### @pi/config (foundation)
- Zod-validated `PiConfig` schema (version 1)
- XDG-aware paths: `~/.pi/pi.json` (or `$XDG_CONFIG_HOME/pi-pro/pi.json`)
- Atomic writes (temp + rename)
- Precedence: defaults < file < env < --config flag
- User-extensible `modes[]` for agent modes

### Agent mode cycle
- `AgentMode` is global, parallel to `VimMode` (editor-local)
- `Tab` key cycles modes
- Bindings: `Tab` + `/mode` + `Ctrl+P`
- Plan mode effects: LlmWorker.setActiveTools + tool gate + READ-ONLY badge

### zentui-style UI
- StarshipFooter: cwd + branch + git icons + runtime + ctx bar + cost
- EditorFrame: bordered input + accent rail + copy-friendly toggle
- Nerd Font detection (heuristic, ASCII fallback)
- 26 language runtime detection (Node, Bun, Deno, Go, Rust, Python, Ruby, etc.)
- Git status parser (porcelain + Nerd Font/ASCII icons)

### v0.9.0 (Telegram)
- @pi/telegram package: bot setup, polling, queue, streaming HTML, voice, lock
- ~128 tests
- Sid's "tailscale ip" experience

## Decisions captured

1. Config foundation first (unblocks every future feature)
2. Schema version 1, migrations for future
3. Agent modes user-extensible
4. Tab cycles (not toggles)
5. Bordered editor + modal vim coexist
6. Plan mode = read-only tools + bash DESTRUCTIVE_PATTERNS
7. Nerd Font detection = heuristic + override
8. Build our own UI (don't depend on pi-zentui)
9. Live LLM bench still deferred
10. Tab dispatch via onTab prop (App owns state)
11. CLI wiring minimal
12. No new dependencies
13. TDD discipline preserved
