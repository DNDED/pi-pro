export const FIXTURE_CONTEXTS: Record<string, string> = {
  "tiny-express": [
    "## Project Context: tiny-express",
    "- Express.js web server with 2 endpoints",
    "- Files: server.js (main app), test.js (node:test runner), package.json",
    "- Endpoints: GET /api/users, GET /api/parse-input",
    "- The /api/users endpoint currently returns password hashes — this is a known bug to fix",
    "- The /api/parse-input endpoint parses comma-separated query params",
    "- Test command: node test.js",
    "- Dependencies: express ^4.19.0",
    "- Node.js 22+ with ES modules (import/export, not require)",
    "- Server listens on port 3000 on startup (causes EADDRINUSE in tests — ignore this error)",
  ].join("\n"),
  "tiny-cli": [
    "## Project Context: tiny-cli",
    "- Python CLI calculator with separate source and test files",
    "- Files: src_calc.py (math functions), test_calc.py (pytest), calc.py (CLI entry), package.json",
    "- Functions in src_calc.py: add, subtract, multiply, divide, power",
    "- Test framework: pytest (if installed). Fallback: run python3 -c to import and test.",
    "- Test command: python3 -m pytest test_calc.py -q",
    "- Python 3.12+",
    "- If pytest is not installed, use: python3 -c 'import src_calc; ...' to verify functions",
  ].join("\n"),
  "tiny-go-svc": [
    "## Project Context: tiny-go-svc",
    "- Go web service with a single main.go",
    "- Files: main.go, main_test.go, go.mod",
    "- Contains a hardcoded 'dbPassword' secret — this is intentional for security audit tasks",
    "- Test command: go test ./...",
    "- Go 1.21+",
  ].join("\n"),
};

export function fixtureContextFor(fixture: string): string {
  return FIXTURE_CONTEXTS[fixture] ?? "";
}
