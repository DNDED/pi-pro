# Changelog

All notable changes to pi-pro are documented here. pi-pro adheres to
[Semantic Versioning](https://semver.org/).

## v0.8.4 — Workflow + UI Overhaul (SHIPPED 2026-06-12)

Targets vs v0.8.3:
- **Workflow foundation:** persistent config + agent mode cycle + plan mode + todo list
- **UI overhaul:** zentui-style Starship footer + bordered editor + Nerd Font detection + git status icons + runtime detection
- **Tab to switch modes** (per Sid's OpenCode-style request)

### New package: `@pi/config` (34 tests)

PiConfig Zod-validated schema with provider/agent/theme/swarm/context/ui/modes sections. Atomic file writes. XDG paths with `PI_HOME_OVERRIDE` escape hatch.

| Module | Purpose |
|---|---|
| `types.ts` | `PiConfigSchema`, `AgentModeSchema`, `validateConfig(input)` |
| `paths.ts` | `getConfigPath()`, `getConfigDir()`, `getAuthPath()` (XDG-aware) |
| `defaults.ts` | `DEFAULT_CONFIG`, `getDefaultModes()` (build + plan) |
| `load.ts` | `loadConfig(path?)` — returns PiConfig (defaults if file missing/bad) |
| `save.ts` | `saveConfig(config, path)` — atomic write (temp + rename) |
| `merge.ts` | `mergeConfig(base, override)` + `applyEnvOverrides(base, env)` (precedence: defaults < file < env) |
| `modes.ts` | `listModes`, `getMode`, `cycleMode`, `getNextMode` |

### Agent mode cycle (build ↔ plan)

| Layer | Addition |
|---|---|
| `@pi/tui-pro` `PromptInput` | `agentMode?: string` prop + BUILD/PLAN badge; `onTab?: () => void` prop; READ-ONLY label |
| `@pi/tui-pro` `util/agent-mode.ts` | `getModeDisplay(name, modes)` — returns `{label, color, readOnly}` |
| `@pi/subagent` `LlmWorker` | `setActiveTools(tools|null)`, `getActiveTools()`, `setBashAllowlist(patterns|null)`, `getBashAllowlist()` |
| `@pi/subagent` `tool-gate.ts` | `isBashDestructive(cmd)`, `isToolActive(tool, set)`, `gateToolCall(tool, args, set, allowlist?)` |

When plan mode active: worker restricts to `["read", "bash", "grep", "find", "ls", "questionnaire"]` + bash DESTRUCTIVE_PATTERNS block list (~30 patterns) + optional bash allowlist (regex).

Bindings: **Tab** (global) + `/mode` command + `Ctrl+P`.

### Plan mode extension (TDD: 21 tests)

| Module | Purpose |
|---|---|
| `extensions/plan-mode-utils.ts` | `isSafeCommand`, `cleanStepText`, `extractTodoItems`, `extractDoneSteps`, `markCompletedSteps`, `countProgress` |
| `extensions/PlanModeWidget.tsx` | Progress widget: `📋 Plan done/total` + ☐/☑ list |

Adapted from [pi-main plan-mode example](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/plan-mode/). Reads `[DONE:n]` markers from assistant text to track execution.

### Todo extension (TDD: 16 tests)

| Module | Purpose |
|---|---|
| `extensions/todo-state.ts` | `Todo` + `TodoState` + `addTodo/toggleTodo/clearTodos/countProgress` |
| `extensions/TodoList.tsx` | UI: `☰ Todos done/total` + #id + ☐/☑ |

State machine designed to persist in tool_result `details` (per pi-main pattern) — survives `/reload` + session branching. CLI `pi todos` is a placeholder for the in-REPL `/todos` command.

### zentui-style UI overhaul (TDD: 33 tests)

Inspired by [pi-zentui](https://pi.dev/packages/pi-zentui) (1,893 downloads/mo).

| Module | Purpose |
|---|---|
| `util/git-status.ts` | `parsePorcelainLine`, `parsePorcelain`, `NERD_FONT_ICONS`, `ASCII_ICONS`, `formatStatusIcons`, `summarizeGitStatus` — pure, no git CLI calls |
| `util/runtime-detect.ts` | `detectRuntime`, `detectRuntimes`, `formatRuntime` — 26 language markers (Node, Bun, Deno, Go, Rust, Python, Ruby, Elixir, C/C++, CMake, Java, Kotlin, Scala, Swift, .NET, Haskell, Lua, Perl, PHP, Pixi, Terraform, Zig, V, R, Mojo) |
| `util/nerd-fonts.ts` | `detectNerdFontsFromEnv`, `detectNerdFonts` — heuristic on TERM/TERM_PROGRAM/FONT_NAME; `PROMYRA_NERD_FONTS=0/1` override |
| `components/StarshipFooter.tsx` | Left: cwd + branch + git icons + runtime + agent mode + todo/plan. Right: context bar (color-graded), cache %, cost, version. |
| `components/EditorFrame.tsx` | Bordered input box with accent rail; model + provider inside; `copyFriendly` mode hides rail for clean copy |

### CLI commands (rewritten + new)

| Command | Status | Notes |
|---|---|---|
| `pi config show` | rewritten | Uses @pi/config; prints PiConfig |
| `pi config set <key> <value>` | rewritten | Top-level (model/agent/theme) + dotted (ui.copyFriendly, ui.statusLine, ui.nerdFonts) |
| `pi config unset <key>` | new | Revert to default (provider.baseUrl only for now) |
| `pi config reset` | new | Back to defaults |
| `pi config path` | new | Print ~/.pi/pi.json path |
| `pi mode [show\|list\|cycle\|set <name>]` | new | Uses cycleMode + getMode |
| `pi plan [toggle\|on\|off]` | new | Switches agent.name build↔plan |
| `pi todos [show\|clear]` | new | Placeholder for in-REPL /todos |
| `pi ui [show\|copy-friendly\|statusline\|nerdfonts]` | new | Toggles ui section |
| `--config <path>` flag | new | Transient override (planned for next commit) |

### Decisions (this build, captured in `memory/decisions/v0.8.4.md`)

- Config schema version 1; migrations table for v1.1+ (none yet)
- Agent modes are user-extensible via `modes[]` in config (build, plan, future review/debug/commit)
- Tab key bound globally; `/mode` + `Ctrl+P` as explicit alternatives
- Bordered editor wraps existing PromptInput (no refactor of vim state machine)
- Git status defaults to 5s TTL; configurable per-cwd
- Nerd Font detection: `$TERM=*nerd*` or `fc-list | grep -i nerd`; else ASCII
- API key never written to config (still in `~/.pi/pi-auth.json` with 0600)
- Live LLM bench still deferred (Go subscription not active at opencode.ai/auth)
- pi-zentui is a strong reference but we don't depend on it (we built our own components in pure Ink)

### Test count

**1321 tests across 19 packages** (was 1160 after v0.8.3; **+161 new**). All passing.

| Package | v0.8.3 | v0.8.4 (this build) | Δ |
|---|---|---|---|
| config (NEW) | — | 34 | NEW |
| tui-pro | 276 | 367 | +91 |
| subagent | 138 | 153 | +15 |
| apps/pi-pro | 111 | 121 | +10 |
| (other 15 packages) | 635 | 646 | +11 (from agent-mode tests in @pi/config) |
| **TOTAL** | **1160** | **1321** | **+161** |

### Files of interest

- `docs/superpowers/specs/2026-06-12-pi-pro-v0.8.4-design.md` — full spec
- `docs/superpowers/plans/2026-06-12-pi-pro-v0.8.4.md` — implementation plan
- `memory/decisions/v0.8.4.md` — v0.8.4 decisions
- `memory/projects/pi-pro.md` — project state (updated)
- `memory/sessions/2026-06-12-pi-pro-v084-design.md` + `v084-build.md` — session logs
- `packages/config/` — new package
- `packages/tui-pro/src/util/agent-mode.ts` — mode display helper
- `packages/tui-pro/src/extensions/plan-mode-utils.ts` + `PlanModeWidget.tsx` — plan mode
- `packages/tui-pro/src/extensions/todo-state.ts` + `TodoList.tsx` — todo list
- `packages/tui-pro/src/util/git-status.ts` + `runtime-detect.ts` + `nerd-fonts.ts` — zentui data
- `packages/tui-pro/src/components/StarshipFooter.tsx` + `EditorFrame.tsx` — zentui UI
- `packages/subagent/src/tool-gate.ts` — DESTRUCTIVE_PATTERNS + isToolActive + gateToolCall

### Out of scope (deferred to v0.8.5+ / v0.9.0)

- LSP integration (typescript-language-server) — v0.8.5
- Web session viewer — v0.8.6
- Plugin system (npm-installable) — v0.9.0 candidate
- Full Telegram adapter (`@pi/telegram`) — v0.9.0
- Sandboxing (Gondolin) — v0.10.0
- Live LLM bench attribution — needs Go subscription activation at opencode.ai/auth

## v0.8.3 — Ex mode UI integration (SHIPPED 2026-06-12)

### TUI components (6 new tests in `packages/tui-pro`)

| Component | Purpose |
|---|---|
| `PromptInput` (refactored) | Renders ex mode: `-- EX --` mode badge in warning color; exBuf at top of input area; mode hint line per mode |

Backwards-compat: insert/normal/visual modes unchanged.

Test count: 1130 → 1136 (+6).

## v0.8.1 — Modal Vim (SHIPPED 2026-06-12)
