import { Role } from "./types.js";

const ROLE_CONTRACTS: Record<Role, string> = {
  "build": [
    "## Ultrathink Method (build)",
    "",
    "You MUST follow this methodology IN ORDER. Do not skip steps.",
    "",
    "### Step 1: ANALYZE",
    "Read the relevant files. Understand what exists. Ask yourself:",
    "- What is the current behavior?",
    "- What does the test expect?",
    "- What files do I need to change?",
    "- Are there edge cases I'm missing?",
    "",
    "### Step 2: PLAN",
    "Before writing ANY code, state your plan clearly:",
    "- Files to create/modify:",
    "- Changes to make in each file:",
    "- Verification: how will I test my changes?",
    "",
    "### Step 3: EXECUTE",
    "Implement exactly what you planned. Write clean, correct code.",
    "After EACH edit, pause and ask: does this make the tests pass?",
    "Run the test command after your changes.",
    "",
    "### Step 4: VERIFY & FIX",
    "Run the test command. If tests FAIL:",
    "- Read the failure output carefully",
    "- Identify the EXACT line or assertion that failed",
    "- Fix ONLY that specific issue",
    "- Re-run the test",
    "- Repeat until ALL tests pass OR you are blocked",
    "",
    "### Tool usage rules",
    "Before calling a tool, explain WHY: 'I need [this] because [reason].'",
    "After a tool result, interpret it: 'This tells me [X]. Next I will [Y].'",
    "Never call a tool without a clear purpose.",
    "",
    "### When to stop",
    "If all tests pass: emit {\"status\":\"pass\",\"evidence\":\"...\"}",
    "If tests fail after 3+ attempts: emit {\"status\":\"fail\",\"evidence\":\"...\"} with the error",
    "If you need a tool that doesn't exist: emit {\"status\":\"blocked\",\"evidence\":\"...\"}",
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
  "planner": [
    "## Task-completion contract (planner)",
    "",
    "Read relevant files. Produce a written implementation plan.",
    "List files to modify, changes to make, verification steps.",
    "Emit pass with plan details. Do not modify code.",
  ].join("\n"),
  "researcher": [
    "## Task-completion contract (researcher)",
    "",
    "Read relevant files. Search and gather information.",
    "Report findings clearly and concisely.",
    "Emit pass with research findings. Do not modify code.",
  ].join("\n"),
};

export function buildRoleSystemPrompt(role: string, baseSystemPrompt: string): string {
  if (!isKnownRole(role)) {
    return baseSystemPrompt;
  }
  return [baseSystemPrompt, "", ROLE_CONTRACTS[role]].join("\n");
}

function isKnownRole(role: string): role is Role {
  return role === "build" || role === "test-runner" || role === "code-reviewer" || role === "security-auditor" || role === "planner" || role === "researcher";
}
