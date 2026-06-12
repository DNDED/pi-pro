import { describe, it, expect } from "vitest";
import { allowedTools, isAllowed } from "../src/tool-restrictions.js";
import { Role, Tool } from "../src/types.js";

const ROLES: Role[] = ["build", "test-runner", "code-reviewer", "security-auditor"];
const TOOLS: Tool[] = ["bash", "read", "write", "edit", "grep", "glob", "webfetch"];

// The single source of truth for the security boundary. Any change to this matrix
// must be intentional and reviewed — this is the lock that prevents privilege
// escalation between subagent roles.
const EXPECTED = {
  "build":            { bash: true,  read: true,  write: true,  edit: true,  grep: true,  glob: true,  webfetch: false },
  "test-runner":      { bash: true,  read: true,  write: false, edit: false, grep: true,  glob: true,  webfetch: false },
  "code-reviewer":    { bash: false, read: true,  write: false, edit: false, grep: true,  glob: true,  webfetch: false },
  "security-auditor": { bash: false, read: true,  write: false, edit: false, grep: true,  glob: true,  webfetch: false },
};

describe("@pi/subagent tool-restrictions", () => {
  describe("full role x tool matrix", () => {
    for (const role of ROLES) {
      const roleMap = (EXPECTED as Record<string, Record<string, boolean>>)[role];
      for (const tool of TOOLS) {
        const expected = roleMap[tool];
        it(`${role} ${expected ? "allows" : "blocks"} ${tool}`, () => {
          expect(isAllowed(role, tool)).toBe(expected);
        });
      }
    }
  });

  describe("allowedTools()", () => {
    it("returns the build role's full set minus webfetch", () => {
      const tools = allowedTools("build");
      expect(tools.sort()).toEqual(["bash", "edit", "glob", "grep", "read", "write"]);
    });

    it("returns the test-runner set with bash/read/grep/glob", () => {
      const tools = allowedTools("test-runner");
      expect(tools.sort()).toEqual(["bash", "glob", "grep", "read"]);
    });

    it("returns read/grep/glob for the code-reviewer", () => {
      const tools = allowedTools("code-reviewer");
      expect(tools.sort()).toEqual(["glob", "grep", "read"]);
    });

    it("returns read/grep/glob for the security-auditor", () => {
      const tools = allowedTools("security-auditor");
      expect(tools.sort()).toEqual(["glob", "grep", "read"]);
    });

    it("returns a copy, not the internal matrix (mutation safe)", () => {
      const a = allowedTools("build");
      const b = allowedTools("build");
      a.push("bash"); // would mutate the internal array if not copied
      expect(b).not.toContain("xxx-evil-mutation-marker");
      // And the original list is still the right length.
      expect(allowedTools("build")).toHaveLength(6);
    });
  });

  describe("explicit security boundary assertions", () => {
    it("code-reviewer CANNOT do bash", () => {
      expect(isAllowed("code-reviewer", "bash")).toBe(false);
    });

    it("security-auditor CANNOT do write", () => {
      expect(isAllowed("security-auditor", "write")).toBe(false);
    });

    it("test-runner CAN do bash but NOT write/edit", () => {
      expect(isAllowed("test-runner", "bash")).toBe(true);
      expect(isAllowed("test-runner", "write")).toBe(false);
      expect(isAllowed("test-runner", "edit")).toBe(false);
    });

    it("build CAN do everything except webfetch", () => {
      for (const t of ["bash", "read", "write", "edit", "grep", "glob"] as Tool[]) {
        expect(isAllowed("build", t)).toBe(true);
      }
      expect(isAllowed("build", "webfetch")).toBe(false);
    });
  });
});
