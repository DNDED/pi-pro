import { describe, it, expect } from "vitest";
import { buildRoleSystemPrompt } from "../src/role-prompt.js";

const basePrompt = "BASE SYSTEM PROMPT\n";

describe("buildRoleSystemPrompt", () => {
  it("returns a string", () => {
    const out = buildRoleSystemPrompt("build", basePrompt);
    expect(typeof out).toBe("string");
  });

  it("preserves the base system prompt verbatim", () => {
    const out = buildRoleSystemPrompt("build", basePrompt);
    expect(out).toContain("BASE SYSTEM PROMPT");
  });

  it("appends a task-completion contract for the build role", () => {
    const out = buildRoleSystemPrompt("build", basePrompt);
    expect(out).toContain("Ultrathink Method");
    expect(out).toContain('"pass"');
    expect(out).toContain('"fail"');
    expect(out).toContain('"blocked"');
  });

  it("appends a task-completion contract for the test-runner role", () => {
    const out = buildRoleSystemPrompt("test-runner", basePrompt);
    expect(out).toContain("Your ONE job is to run the test command");
    expect(out).toMatch(/Emit pass if all tests pass/);
    expect(out).toContain("Do not modify code");
  });

  it("appends a task-completion contract for the code-reviewer role", () => {
    const out = buildRoleSystemPrompt("code-reviewer", basePrompt);
    expect(out).toContain("Read the diff");
    expect(out).toContain("Emit pass if you find no issues");
    expect(out).toContain("Do not modify code");
  });

  it("appends a task-completion contract for the security-auditor role", () => {
    const out = buildRoleSystemPrompt("security-auditor", basePrompt);
    expect(out).toContain("Read the diff");
    expect(out).toContain("security patterns");
    expect(out).toContain("Emit pass if no issues");
    expect(out).toContain("Do not modify code");
  });

  it("preserves the base system prompt at the start of the output", () => {
    const out = buildRoleSystemPrompt("build", basePrompt);
    expect(out.indexOf("BASE SYSTEM PROMPT")).toBe(0);
  });

  it("returns the base prompt unchanged for an unknown role", () => {
    const out = buildRoleSystemPrompt("not-a-real-role", basePrompt);
    expect(out).toBe(basePrompt);
  });

  it("buildRoleSystemPrompt includes all 4 ultrathink steps for the build role", () => {
    const out = buildRoleSystemPrompt("build", basePrompt);
    expect(out).toMatch(/ANALYZE/);
    expect(out).toMatch(/PLAN/);
    expect(out).toMatch(/EXECUTE/);
    expect(out).toMatch(/VERIFY/);
  });

  it("buildRoleSystemPrompt includes diff self-review guidance for the code-reviewer role", () => {
    const out = buildRoleSystemPrompt("code-reviewer", basePrompt);
    expect(out).toMatch(/Read the diff/);
    expect(out).toContain("Do not modify code");
    const hasReviewGuidance = /review|Self-review/i.test(out);
    expect(hasReviewGuidance).toBe(true);
  });
});
