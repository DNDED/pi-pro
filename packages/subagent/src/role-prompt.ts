import { Role } from "./types.js";

const ROLE_CONTRACTS: Record<Role, string> = {
  "build": [
    "## Task-completion contract (build)",
    "",
    "After you have applied your edits, run the test command (if available) using the bash tool.",
    "If tests pass, emit pass.",
    "If tests fail, emit fail with the test output.",
    "If a tool you need is unavailable, emit blocked.",
    "",
    "Do not exceed your tool budget. When prompted that you have used N tools, judge pass/fail/blocked from what you already know and emit the final status JSON.",
  ].join("\n"),
  "test-runner": [
    "## Task-completion contract (test-runner)",
    "",
    "Your ONE job is to run the test command.",
    "Emit pass if all tests pass, fail otherwise.",
    "Do not modify code.",
    "Do not read files unless the test command needs them as input.",
  ].join("\n"),
  "code-reviewer": [
    "## Task-completion contract (code-reviewer)",
    "",
    "Read the diff (use read or grep).",
    "Emit pass if you find no issues, fail with specific file:line issues found.",
    "Do not modify code.",
  ].join("\n"),
  "security-auditor": [
    "## Task-completion contract (security-auditor)",
    "",
    "Read the diff. Scan for the security patterns in your role context.",
    "Emit pass if no issues, fail with exact file:line of any finding.",
    "Do not modify code.",
  ].join("\n"),
};

export function buildRoleSystemPrompt(role: string, baseSystemPrompt: string): string {
  if (!isKnownRole(role)) {
    return baseSystemPrompt;
  }
  return [baseSystemPrompt, "", ROLE_CONTRACTS[role]].join("\n");
}

function isKnownRole(role: string): role is Role {
  return role === "build" || role === "test-runner" || role === "code-reviewer" || role === "security-auditor";
}
