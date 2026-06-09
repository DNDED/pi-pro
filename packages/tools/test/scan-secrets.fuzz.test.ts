/**
 * Property-based / fuzz tests for packages/tools/src/policy.ts:scanForSecrets.
 *
 * Separate from the policy fuzz file because secret-scanning and shell-policy
 * are distinct concerns (and the bench runner may want to run them in
 * isolation).
 *
 * Properties:
 *   1. Never throws, even on 10KB random strings.
 *   2. A single run completes in < 500ms (no ReDoS — generous margin over the
 *      100ms target to avoid flakiness on slow CI).
 *   3. A string containing only whitespace and punctuation returns [].
 *
 * Defaults to 100 iterations per property to keep CI fast.
 * Bump locally with FAST_CHECK_ITERATIONS=1000 npx vitest run.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { scanForSecrets } from "../src/policy.js";

const ITER = Number(process.env.FAST_CHECK_ITERATIONS ?? 100);

const FULL_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \t\n-_=+!@#$%^&*()[]{};:'\",.<>/?\\|~`";

describe("scan-secrets fuzz: scanForSecrets", () => {
  it("property 1: never throws, even on 10KB random strings", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...FULL_ALPHABET.split("")), {
          minLength: 0,
          maxLength: 10_000,
        }),
        (chars) => {
          const s = chars.join("");
          // Just must not throw and must return an array.
          const out = scanForSecrets(s);
          return Array.isArray(out);
        }
      ),
      { numRuns: ITER }
    );
  });

  it("property 2: a single run completes in < 500ms (no ReDoS)", () => {
    // We use 500ms as a generous upper bound; the 100ms target is the
    // engineering spec. We allow 5x headroom for slow CI runners.
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...FULL_ALPHABET.split("")), {
          minLength: 100,
          maxLength: 5_000,
        }),
        (chars) => {
          const s = chars.join("");
          const start = Date.now();
          scanForSecrets(s);
          const elapsed = Date.now() - start;
          return elapsed < 500;
        }
      ),
      { numRuns: ITER }
    );
  });

  it("property 3: a string of only whitespace and punctuation returns []", () => {
    // Whitespace + punctuation should never trigger a secret pattern.
    const wsPunctArb = fc
      .array(
        fc.constantFrom(
          " ",
          "\t",
          "\n",
          "\r",
          "-",
          "_",
          "=",
          "+",
          "!",
          "@",
          "#",
          "$",
          "%",
          "^",
          "&",
          "*",
          "(",
          ")",
          "[",
          "]",
          "{",
          "}",
          ";",
          ":",
          "'",
          '"',
          ",",
          ".",
          "<",
          ">",
          "/",
          "?",
          "\\",
          "|",
          "~",
          "`"
        ),
        { minLength: 0, maxLength: 2000 }
      );
    fc.assert(
      fc.property(wsPunctArb, (chars) => {
        const s = chars.join("");
        return scanForSecrets(s).length === 0;
      }),
      { numRuns: ITER }
    );
  });
});
