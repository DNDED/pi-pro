# Contributing to @promyra/skill-bundle

Thank you for your interest in contributing to `@promyra/skill-bundle`!

## What is this package?

`@promyra/skill-bundle` is a curated collection of skills (prompt templates) for
promyra, an AI coding agent. Each skill is a markdown file with YAML frontmatter
that defines a specific capability (e.g., code review, debugging, refactoring).

## How to contribute a new skill

1. **Create a new skill file** in `skills/` following the naming convention:
   `<skill-name>.md` (lowercase, hyphenated).

2. **Include YAML frontmatter** with these required fields:
   ```yaml
   ---
   name: skill-name
   description: One-line description of what this skill does
   triggers:
     - keyword1
     - keyword2
   ---
   ```

3. **Write the skill prompt** in markdown below the frontmatter. Be specific
   about what the skill should do, what constraints it has, and what output
   format is expected.

4. **Add tests** in `test/` to verify:
   - The skill loads correctly (frontmatter parses, prompt is non-empty)
   - The skill is discoverable via the loader
   - The skill's triggers match expected keywords

5. **Update the README** (this file) if your skill introduces new concepts.

## Skill design principles

- **Single responsibility**: Each skill should do one thing well.
- **Composable**: Skills should work independently and not assume other skills
  are loaded.
- **Testable**: Every skill should have at least one test that verifies it
  loads and has the expected structure.
- **Documented**: The description field should be clear enough that a user
  knows when to invoke the skill.

## Code style

- TypeScript for any loader/utility code
- Markdown for skill prompts
- Vitest for tests
- Follow existing patterns in `src/` and `test/`

## Testing

```bash
pnpm test          # run all tests
pnpm typecheck     # type-check without emit
pnpm coverage      # run tests with coverage report
```

## Questions?

Open an issue on the promyra repository.
