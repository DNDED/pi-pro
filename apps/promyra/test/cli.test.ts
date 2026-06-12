import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, "..", "bin", "promyra");

function runPromyra(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync("node", [BIN, ...args], {
    cwd: opts.cwd ?? process.cwd(),
    env: { ...process.env, ...opts.env },
    encoding: "utf8",
  });
  return {
    status: res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

describe("promyra CLI binary", () => {
  it("--version exits 0 and prints 0.1.0", () => {
    const r = runPromyra(["--version"]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("0.8.0");
  });

  it("--help exits 0 and lists all 6 subcommands", () => {
    const r = runPromyra(["--help"]);
    expect(r.status).toBe(0);
    for (const cmd of ["resume", "replay", "merge", "doctor", "config", "bench"]) {
      expect(r.stdout).toContain(cmd);
    }
  });

  it("config show exits 0 and prints the provider: line", () => {
    const r = runPromyra(["config", "show"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/provider:\s+\w+/);
  });

  it("doctor exits 0 when run in a real git repo with skills", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cli-doctor-"));
    try {
      execSync("git init -q", { cwd: dir });
      execSync("git config user.email t@local", { cwd: dir });
      execSync("git config user.name t", { cwd: dir });
      execSync("git commit --allow-empty -q -m init", { cwd: dir });
      const r = runPromyra(["doctor"], { cwd: dir });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/All checks passed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("doctor exits 1 when run outside a git repo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cli-doctor-"));
    try {
      const r = runPromyra(["doctor"], { cwd: dir });
      expect(r.status).toBe(1);
      expect(r.stdout).toMatch(/Some checks failed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("surfaces clear error when no args and stdout is not a TTY", () => {
    const r = runPromyra([], { env: { ...process.env, CI: "true" } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("not running in a TTY");
  });

  it("surfaces clear error when task arg given but stdout is not a TTY", () => {
    const r = runPromyra(["fix", "auth", "bug"], { env: { ...process.env, CI: "true" } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("not running in a TTY");
  });

  it("'help' subcommand shows help text instead of launching TUI with 'help' pre-filled", () => {
    const r = runPromyra(["help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Usage:");
    expect(r.stdout).not.toContain("Ask anything");
  });

  it("--check prints env and config without launching TUI", () => {
    const r = runPromyra(["--check"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("promyra v0.8.0");
    expect(r.stdout).toContain("stdout.isTTY:");
    expect(r.stdout).toContain("config:");
    expect(r.stdout).not.toContain("Ask anything");
  });
});
