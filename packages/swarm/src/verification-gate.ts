/**
 * v0.6.0 VerificationGate.
 *
 * Parses test output from common frameworks (pytest, jest, go test,
 * generic) and returns a uniform `TestResult`. The orchestrator uses
 * this to decide pass/fail for the swarm's verification gate.
 *
 * Heuristics: matches framework-specific summary lines, then falls back
 * to exit code. NOT a substitute for real test output — just enough to
 * drive a retry decision.
 */

import type { TestResult } from "./types.js";

const MAX_OUTPUT = 2000;

function tail(s: string, n: number = MAX_OUTPUT): string {
  return s.length > n ? s.slice(-n) : s;
}

export function parseTestOutput(
  framework: string,
  exitCode: number,
  stdout: string,
  stderr: string,
): TestResult {
  const all = stdout + "\n" + stderr;

  // Skip detection
  if (/SKIP\s*:/i.test(all)) {
    const m = all.match(/SKIP\s*:[^\n]*/i);
    return {
      passed: false,
      command: framework,
      exitCode,
      stdoutTail: tail(stdout),
      stderrTail: tail(stderr),
      failures: [],
      skipped: true,
      skipReason: m?.[0]?.trim() ?? "skipped",
      durationMs: 0,
    };
  }

  const failures: string[] = [];

  if (framework === "pytest" || framework === "py") {
    // pytest summary variants:
    //   "===== 5 passed, 1 failed in 0.3s ====="
    //   "===== 1 failed in 0.1s ====="
    //   "===== 1 passed in 0.5s ====="
    const fullSummary = all.match(/=+\s*(\d+)\s+passed(?:,\s*(\d+)\s+failed)?.*?=+/);
    const failOnly = all.match(/=+\s*(\d+)\s+failed\s+in\s+/);
    if (fullSummary || failOnly) {
      let failed = 0;
      if (fullSummary) {
        failed = parseInt(fullSummary[2] ?? "0", 10);
      } else if (failOnly) {
        failed = parseInt(failOnly[1], 10);
      }
      const failedLines = [...stdout.matchAll(/^FAILED\s+(\S+)/gm)].map(m => m[1]);
      if (failedLines.length > 0) {
        for (const fl of failedLines.slice(0, failed)) failures.push(fl);
      } else {
        for (let i = 0; i < failed; i++) failures.push(`test #${i + 1} failed`);
      }
      return mkResult(exitCode, failed === 0, failures, stdout, stderr);
    }
  }

  if (framework === "jest" || framework === "node") {
    // jest: "Tests: 2 failed, 3 passed, 5 total"
    const m = all.match(/Tests:\s*(\d+)\s+failed(?:,\s*(\d+)\s+passed)?/);
    if (m) {
      const failed = parseInt(m[1], 10);
      const failedTests = [...stdout.matchAll(/^[✕×]\s+(.+)/gm)].map(x => x[1]);
      if (failedTests.length > 0) {
        for (const ft of failedTests.slice(0, failed)) failures.push(ft);
      } else {
        for (let i = 0; i < failed; i++) failures.push(`test #${i + 1} failed`);
      }
      return mkResult(exitCode, failed === 0, failures, stdout, stderr);
    }
  }

  if (framework === "go") {
    // go test: "FAIL\tpkg/foo\t0.1s" + "--- FAIL: TestFoo"
    const fails = [...stdout.matchAll(/^---\s+FAIL:\s+(\S+)/gm)];
    for (const f of fails) failures.push(f[1]);
    const ok = exitCode === 0 && fails.length === 0;
    return mkResult(exitCode, ok, failures, stdout, stderr);
  }

  // Generic fallback
  const ok = exitCode === 0;
  return mkResult(exitCode, ok, ok ? [] : [`exit code ${exitCode}`], stdout, stderr);
}

function mkResult(
  exitCode: number,
  passed: boolean,
  failures: string[],
  stdout: string,
  stderr: string,
): TestResult {
  return {
    passed,
    command: "",
    exitCode,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
    failures,
    skipped: false,
    durationMs: 0,
  };
}

export class VerificationGate {
  /** Test command for a given fixture, matching the bench runner convention. */
  static testCommandFor(fixture: string): string {
    switch (fixture) {
      case "tiny-express": return "node test.js";
      case "tiny-cli": return "python3 -m pytest test_calc.py -q 2>&1";
      case "tiny-go-svc": return "go test ./... 2>&1";
      default: return `echo 'SKIP: unknown fixture ${fixture}'`;
    }
  }

  /** Detect framework from fixture name. */
  static frameworkFor(fixture: string): "pytest" | "jest" | "go" | "node" | "unknown" {
    if (fixture === "tiny-cli") return "pytest";
    if (fixture === "tiny-express") return "node";
    if (fixture === "tiny-go-svc") return "go";
    return "unknown";
  }
}
