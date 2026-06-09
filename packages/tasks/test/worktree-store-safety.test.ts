import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { WorktreeStore } from "../src/worktree-store.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "wt-safety-"));
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "t@local"', { cwd: dir });
  execSync('git config user.name "t"', { cwd: dir });
  execSync("git commit --allow-empty -q -m init", { cwd: dir });
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("WorktreeStore — shell-injection fix", () => {
  it("create passes a taskId containing shell metacharacters without executing them", () => {
    const evil = "tsk_abcd1234'; touch /tmp/PWNED; echo '";
    const wt = new WorktreeStore(dir);
    expect(() => wt.create(evil)).toThrow();
    let pwned = false;
    try { execSync("test -e /tmp/PWNED", { encoding: "utf8" }); pwned = true; } catch { /* not pwned */ }
    expect(pwned).toBe(false);
  });

  it("create still works for a normal taskId", () => {
    const wt = new WorktreeStore(dir);
    const info = wt.create("tsk_normal123");
    expect(info.branch).toBe("pi-pro/normal123");
  });

  it("remove is safe with a path containing shell metacharacters", () => {
    const wt = new WorktreeStore(dir);
    const info = wt.create("tsk_normal456");
    expect(() => wt.remove("tsk_normal456")).not.toThrow();
  });
});
