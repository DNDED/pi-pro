import { describe, it, expect } from "vitest";
import { runChecks, formatCheckResults } from "../src/commands/doctor.js";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("formatCheckResults", () => {
  it("emits a checkmark for ok results", () => {
    const out = formatCheckResults([{ name: "git installed", ok: true, detail: "git version 2.0" }]);
    expect(out).toMatch(/✓ git installed/);
  });

  it("emits an X for failing results", () => {
    const out = formatCheckResults([{ name: "current dir is a git repo", ok: false, detail: "no — run from inside a repo" }]);
    expect(out).toMatch(/✗ current dir is a git repo/);
  });

  it("prints 'All checks passed.' when every result is ok", () => {
    const out = formatCheckResults([
      { name: "a", ok: true, detail: "1" },
      { name: "b", ok: true, detail: "2" },
    ]);
    expect(out).toMatch(/All checks passed\./);
  });

  it("prints 'Some checks failed.' when any result is not ok", () => {
    const out = formatCheckResults([
      { name: "a", ok: true, detail: "1" },
      { name: "b", ok: false, detail: "broken" },
    ]);
    expect(out).toMatch(/Some checks failed\./);
  });

  it("includes the detail of each check", () => {
    const out = formatCheckResults([
      { name: "git installed", ok: true, detail: "git version 2.42.0" },
    ]);
    expect(out).toContain("git version 2.42.0");
  });
});

describe("runChecks", () => {
  it("returns 4 checks in the real repo", async () => {
    const results = await runChecks();
    expect(results).toHaveLength(4);
    const names = results.map(r => r.name);
    expect(names).toContain("git installed");
    expect(names).toContain("current dir is a git repo");
    expect(names).toContain("@pi/skill-bundle loads");
    expect(names).toContain("default system prompt");
  });

  it("reports git installed as ok in this environment", async () => {
    const results = await runChecks();
    const git = results.find(r => r.name === "git installed");
    expect(git?.ok).toBe(true);
  });

  it("returns ok=false for a non-repo directory (no .git)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "doctor-test-"));
    try {
      const results = await runChecks({ cwd: dir });
      const repo = results.find(r => r.name === "current dir is a git repo");
      expect(repo?.ok).toBe(false);
      expect(repo?.detail).toMatch(/no/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns ok=true for a real (empty-commit) git repo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "doctor-test-"));
    try {
      execSync("git init -q", { cwd: dir });
      execSync("git config user.email t@local", { cwd: dir });
      execSync("git config user.name t", { cwd: dir });
      execSync("git commit --allow-empty -q -m init", { cwd: dir });
      const results = await runChecks({ cwd: dir });
      const repo = results.find(r => r.name === "current dir is a git repo");
      expect(repo?.ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
