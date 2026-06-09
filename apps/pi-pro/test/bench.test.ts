import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { printSummary, shouldSkip, benchCommand } from "../src/commands/bench.js";
import type { BenchSummary, BenchResult } from "@pi/bench";

function makeResult(over: Partial<BenchResult> = {}): BenchResult {
  return {
    taskId: "refactor-helper",
    fixture: "tiny-express",
    description: "Refactor parser",
    completed: true,
    tokensIn: 100,
    tokensOut: 50,
    wallMs: 1000,
    testCommand: "node test.js",
    testExitCode: 0,
    testOutput: "ok",
    fixtureCopyPath: "/tmp/wt",
    ...over,
  };
}

function makeSummary(results: BenchResult[]): BenchSummary {
  const completed = results.filter(r => r.completed).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.completed && !r.skipped).length;
  return {
    total: results.length,
    completed,
    failed,
    skipped,
    tokensIn: results.reduce((s, r) => s + r.tokensIn, 0),
    tokensOut: results.reduce((s, r) => s + r.tokensOut, 0),
    wallMs: results.reduce((s, r) => s + r.wallMs, 0),
    results,
  };
}

describe("printSummary", () => {
  it("prints all 5 tasks as successful", () => {
    const results = Array.from({ length: 5 }, (_, i) => makeResult({
      taskId: `task${i}`,
      fixture: i % 2 ? "tiny-cli" : "tiny-express",
      completed: true,
    }));
    const out = printSummary(makeSummary(results));
    expect(out).toContain("task0");
    expect(out).toContain("task4");
    expect(out).toContain("5/5 one-shot");
    expect(out).toContain("100% raw");
  });

  it("prints all 5 tasks as failed", () => {
    const results = Array.from({ length: 5 }, (_, i) => makeResult({
      taskId: `task${i}`,
      completed: false,
      error: "kaboom",
    }));
    const out = printSummary(makeSummary(results));
    expect(out).toContain("0/5 one-shot");
    expect(out).toContain("kaboom");
  });

  it("prints mixed success/failure", () => {
    const results = [
      makeResult({ taskId: "ok1", completed: true }),
      makeResult({ taskId: "bad1", completed: false, error: "boom" }),
      makeResult({ taskId: "ok2", completed: true }),
    ];
    const out = printSummary(makeSummary(results));
    expect(out).toContain("2/3 one-shot");
    expect(out).toContain("boom");
  });

  it("prints skipped status with skipReason", () => {
    const results = [
      makeResult({ taskId: "sk1", completed: false, skipped: true, skipReason: "missing go" }),
    ];
    const out = printSummary(makeSummary(results));
    expect(out).toContain("sk1");
    expect(out).toContain("missing go");
    expect(out).toContain("Skipped: 1");
  });

  it("includes token + wall time totals", () => {
    const results = [makeResult({ tokensIn: 10, tokensOut: 20, wallMs: 2500 })];
    const out = printSummary(makeSummary(results));
    expect(out).toMatch(/Tokens: in=10, out=20/);
    expect(out).toMatch(/Wall:.*2\.5s/);
  });

  it("handles an empty result list without dividing by zero", () => {
    const out = printSummary(makeSummary([]));
    expect(out).toContain("0/0 one-shot");
    expect(out).toMatch(/0% raw/);
  });
});

describe("shouldSkip", () => {
  it("returns a non-skipped result for tiny-express when bootstrap succeeds", () => {
    const r = shouldSkip("tiny-express", { bootstrapped: true });
    expect(r.skipped).toBe(false);
  });

  it("returns a skipped result for tiny-express when bootstrap fails with a clear hint", () => {
    const r = shouldSkip("tiny-express", { bootstrapped: false, message: "no package.json" });
    expect(r.skipped).toBe(true);
    expect(r.reason).toContain("no package.json");
  });

  it("returns a skipped result for tiny-cli when pip install fails", () => {
    const r = shouldSkip("tiny-cli", { bootstrapped: false, message: "pip install pytest failed: nope" });
    expect(r.skipped).toBe(true);
    expect(r.reason).toContain("pytest");
  });

  it("returns a skipped result for tiny-go-svc because go cannot be bootstrapped from node", () => {
    const r = shouldSkip("tiny-go-svc", { bootstrapped: false, message: "go toolchain not bootstrapable from node" });
    expect(r.skipped).toBe(true);
    expect(r.reason).toContain("go");
  });
});

describe("benchCommand orchestrator", () => {
  let home: string;
  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "bench-home-"));
    process.env.PI_PRO_HOME_OVERRIDE = home;
    delete process.env.OPENCODE_GO_API_KEY;
  });
  afterEach(async () => {
    delete process.env.PI_PRO_HOME_OVERRIDE;
    delete process.env.OPENCODE_GO_API_KEY;
    await rm(home, { recursive: true, force: true });
  });

  it("exits with error when no API key is configured", async () => {
    const origExit = process.exit;
    let exitCode: number | undefined;
    (process as any).exit = (code: number) => { exitCode = code; throw new Error("EXIT"); };
    const origErr = console.error;
    const errs: string[] = [];
    console.error = (...args: unknown[]) => { errs.push(args.join(" ")); };
    try {
      await benchCommand();
    } catch {
      // expected
    } finally {
      (process as any).exit = origExit;
      console.error = origErr;
    }
    expect(exitCode).toBe(1);
    expect(errs.join("\n")).toMatch(/no OpenCode Go API key/);
  });
});
