# User Preferences (Sid)

Communication and workflow preferences for working with Sid. Load at session start.

## Tone
- **Concise by default.** No preamble, no postamble, no filler. One-word answers when one line suffices. Per `~/.config/opencode/skills/sid-caveman-responses/SKILL.md` + `~/.config/opencode/skills/sid-preferences/sid-concise-completions/SKILL.md`.
- **Expand only when:** Sid asks why/how, plans, warnings, or ambiguity must be resolved.
- **No emojis** in any output (including memory files, code, comments) unless Sid explicitly requests them.

## Workflow
- **No commits, pushes, or PRs without explicit ask.** Per `~/.config/opencode/AGENTS.md`. Sid typically asks "ok continue build" or "ok build" — that means execute, not commit. He commits manually with `git add -A && git commit -m "..."`.
- **TDD discipline** — tests written first, commit per feature. The `test-driven-development` skill is a HARD GATE for non-trivial work.
- **No comments in code** unless Sid asks. Per `~/.config/opencode/AGENTS.md`.
- **Use brainstorming** (decomposition-first) for any new feature/component/refactor. HARD GATE.
- **Use writing-plans** after brainstorming. HARD GATE.

## Decision style
- **Sid takes the "Recommended" option** ~95% of the time. When designing, lead with the recommended option, explain why, and present 2-3 alternatives.
- **Sid picks ambitious scope** when given the choice. Prefers "Full swarm" over "Minimal" when the research supports it.
- **Sid asks "ok continue build" or "ok build"** to mean: execute the plan, build the thing, ship. Do not ask clarifying questions for the next step unless there's a real fork.
- **Sid says "fix the rest"** to mean: finish the pending items in the current scope. Don't expand.
- **Sid says "ok continue build and also X"** to mean: combine continuation with side task X. Both in the same turn.

## Tooling preferences
- **pnpm workspaces** for Node monorepos. pnpm-lock.yaml is committed.
- **TypeScript** for everything (no JS unless it's a config file).
- **vitest** for tests, `tsc` for typecheck/build.
- **Ink + React** for TUI.
- **Tree-sitter lazy-loaded** (avoid native build when possible).

## Memory
- **In-repo memory** for active projects (e.g. pi-pro → `memory/`). One source of truth, version-controlled with the project.
- **Obsidian vault** for cross-project memory and Hermes sessions.
- See `memory/AGENTS-rules.md` for the auto-recall + auto-store + session-end checklist.

## "Buncha shit" requests
- When Sid says "add a buncha shit" or "a bunch of features", interpret as: full scope, ambitious, but with decomposition-first. Don't limit to a minimal subset.
- Use the agent swarm (parallel subagents via Task tool) when research is needed before brainstorming.
