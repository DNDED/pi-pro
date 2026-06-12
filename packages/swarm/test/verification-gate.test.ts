import { describe, it, expect } from "vitest";
import { VerificationGate, parseTestOutput } from "../src/verification-gate.js";

describe("parseTestOutput — pytest", () => {
  it("parses all-passed summary", () => {
    const r = parseTestOutput("pytest", 0, "===== 5 passed, 1 skipped in 0.5s =====", "");
    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
    expect(r.skipped).toBe(false);
  });

  it("parses failed summary", () => {
    const r = parseTestOutput("pytest", 1, "===== 2 passed, 3 failed in 1.2s =====", "");
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBe(3);
  });

  it("extracts failure file:line from FAILED line", () => {
    const out = "FAILED tests/test_foo.py::test_bar - assert x == 1\n===== 1 failed in 0.1s =====";
    const r = parseTestOutput("pytest", 1, out, "");
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain("test_foo.py");
  });

  it("parses skip message", () => {
    const r = parseTestOutput("pytest", 0, "SKIP: pytest not available\n0 collected", "");
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toContain("pytest");
  });
});

describe("parseTestOutput — jest", () => {
  it("parses jest passed", () => {
    const out = "Tests: 5 passed, 5 total";
    const r = parseTestOutput("jest", 0, out, "");
    expect(r.passed).toBe(true);
  });

  it("parses jest failed", () => {
    const out = "Tests: 2 failed, 3 passed, 5 total\n  ✕ should do thing\n  ✓ should do other";
    const r = parseTestOutput("jest", 1, out, "");
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBe(2);
  });
});

describe("parseTestOutput — go test", () => {
  it("parses go test pass", () => {
    const r = parseTestOutput("go", 0, "ok\tpkg/foo\t0.5s\nok\tpkg/bar\t0.3s", "");
    expect(r.passed).toBe(true);
  });

  it("parses go test fail", () => {
    const out = "--- FAIL: TestFoo (0.1s)\nfoo_test.go:10: expected x, got y\nFAIL\tpkg/foo\t0.1s\nok\tpkg/bar\t0.2s";
    const r = parseTestOutput("go", 1, out, "");
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBeGreaterThan(0);
    expect(r.failures[0]).toContain("TestFoo");
  });
});

describe("parseTestOutput — generic", () => {
  it("exit 0 = pass when no failure markers", () => {
    const r = parseTestOutput("unknown", 0, "all good\n", "");
    expect(r.passed).toBe(true);
  });

  it("non-zero exit = fail", () => {
    const r = parseTestOutput("unknown", 1, "something broke", "stack trace here");
    expect(r.passed).toBe(false);
  });

  it("SKIP in output = skipped, not failed", () => {
    const r = parseTestOutput("unknown", 0, "SKIP: no test runner available", "");
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toContain("no test runner");
  });
});

describe("parseTestOutput — output size", () => {
  it("truncates stdout to last 2000 chars", () => {
    const longOut = "x".repeat(5000);
    const r = parseTestOutput("unknown", 0, longOut, "");
    expect(r.stdoutTail.length).toBe(2000);
  });

  it("truncates stderr to last 2000 chars", () => {
    const longErr = "e".repeat(5000);
    const r = parseTestOutput("unknown", 1, "", longErr);
    expect(r.stderrTail.length).toBe(2000);
  });
});

describe("VerificationGate — testCommandFor", () => {
  it("returns node test command for tiny-express", () => {
    expect(VerificationGate.testCommandFor("tiny-express")).toContain("node test.js");
  });

  it("returns pytest command for tiny-cli", () => {
    expect(VerificationGate.testCommandFor("tiny-cli")).toContain("pytest");
  });

  it("returns go test command for tiny-go-svc", () => {
    expect(VerificationGate.testCommandFor("tiny-go-svc")).toContain("go test");
  });

  it("returns SKIP echo for unknown fixture", () => {
    expect(VerificationGate.testCommandFor("unknown-fixture")).toContain("SKIP");
  });
});
