import { describe, it, expect } from "vitest";
import { buildPrompt } from "../src/roles/build.js";
import { testRunnerPrompt } from "../src/roles/test-runner.js";
import { codeReviewerPrompt } from "../src/roles/code-reviewer.js";
import { securityAuditorPrompt } from "../src/roles/security-auditor.js";
import { StepContext } from "../src/types.js";

const baseCtx: StepContext = {
  taskId: "tsk_abc",
  stepId: "s1",
  description: "Add /healthz endpoint",
  worktreePath: "/tmp/worktree-1",
};

describe("@promyra/subagent role prompts", () => {
  describe("build", () => {
    it("includes the description", () => {
      expect(buildPrompt(baseCtx)).toContain("Add /healthz endpoint");
    });

    it("includes the worktree path", () => {
      expect(buildPrompt(baseCtx)).toContain("/tmp/worktree-1");
    });

    it("includes the TDD rules", () => {
      const out = buildPrompt(baseCtx);
      expect(out).toContain("TDD");
      expect(out).toMatch(/failing test/i);
    });

    it("identifies itself as the BUILD subagent", () => {
      expect(buildPrompt(baseCtx)).toContain("BUILD");
    });
  });

  describe("test-runner", () => {
    it("mentions running the test command", () => {
      const out = testRunnerPrompt(baseCtx);
      expect(out).toMatch(/pnpm test|npm test|test command|test suite/i);
    });

    it("restricts to read-only tools (no write/edit)", () => {
      const out = testRunnerPrompt(baseCtx);
      expect(out).toMatch(/No write/i);
    });
  });

  describe("code-reviewer", () => {
    it("mentions reading the diff", () => {
      const out = codeReviewerPrompt(baseCtx);
      expect(out).toMatch(/diff/i);
    });

    it("includes the actual diff content when provided", () => {
      const out = codeReviewerPrompt({ ...baseCtx, diff: "+ new line\n- old line" });
      expect(out).toContain("+ new line");
      expect(out).toContain("- old line");
    });

    it("falls back gracefully when no diff is provided", () => {
      const out = codeReviewerPrompt({ ...baseCtx, diff: undefined });
      expect(out).toContain("no diff provided");
    });
  });

  describe("security-auditor", () => {
    it("mentions secret detection", () => {
      const out = securityAuditorPrompt(baseCtx);
      expect(out).toMatch(/secrets?/i);
    });

    it("mentions unsafe shell patterns", () => {
      const out = securityAuditorPrompt(baseCtx);
      expect(out).toMatch(/rm -rf|curl \| sh|SSRF|SQL injection/i);
    });

    it("includes the actual diff content when provided", () => {
      const out = securityAuditorPrompt({ ...baseCtx, diff: "AKIAIOSFODNN7EXAMPLE" });
      expect(out).toContain("AKIAIOSFODNN7EXAMPLE");
    });
  });

  it("all role prompts identify their role and the task/step", () => {
    expect(buildPrompt(baseCtx)).toContain("tsk_abc");
    expect(buildPrompt(baseCtx)).toContain("s1");
    expect(testRunnerPrompt(baseCtx)).toContain("tsk_abc");
    expect(codeReviewerPrompt(baseCtx)).toContain("tsk_abc");
    expect(securityAuditorPrompt(baseCtx)).toContain("tsk_abc");
  });
});
