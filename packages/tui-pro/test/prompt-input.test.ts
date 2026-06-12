import { describe, it, expect } from "vitest";
import { wordForward, wordBackward } from "../src/index.js";

describe("wordForward", () => {
  it("returns end of string when at end", () => {
    expect(wordForward("hello", 5)).toBe(5);
  });

  it("advances to next word when at a word", () => {
    expect(wordForward("hello world", 0)).toBe(6);
  });

  it("skips whitespace then to next word", () => {
    expect(wordForward("hello   world", 0)).toBe(8);
  });

  it("handles multiple spaces", () => {
    expect(wordForward("a   b", 0)).toBe(4);
  });

  it("returns end when no next word", () => {
    expect(wordForward("hello   ", 0)).toBe(8);
  });

  it("starts from middle of word", () => {
    expect(wordForward("hello world", 3)).toBe(6);
  });

  it("handles empty string", () => {
    expect(wordForward("", 0)).toBe(0);
  });

  it("handles single word", () => {
    expect(wordForward("hello", 0)).toBe(5);
  });

  it("handles punctuation between words", () => {
    expect(wordForward("foo, bar", 0)).toBe(5);
  });

  it("handles underscore as word char", () => {
    expect(wordForward("foo_bar baz", 0)).toBe(8);
  });
});

describe("wordBackward", () => {
  it("returns 0 when at start", () => {
    expect(wordBackward("hello", 0)).toBe(0);
  });

  it("goes to start of current word", () => {
    expect(wordBackward("hello world", 8)).toBe(6);
  });

  it("goes back to previous word", () => {
    expect(wordBackward("hello world", 11)).toBe(6);
  });

  it("skips whitespace to previous word", () => {
    expect(wordBackward("a   b", 4)).toBe(0);
  });

  it("handles empty string", () => {
    expect(wordBackward("", 0)).toBe(0);
  });

  it("handles single word at end", () => {
    expect(wordBackward("hello", 5)).toBe(0);
  });

  it("handles underscore as word char", () => {
    expect(wordBackward("foo_bar baz", 8)).toBe(0);
  });

  it("clamps when from > length", () => {
    expect(wordBackward("hello", 100)).toBe(0);
  });
});

describe("clamp (via edge cases)", () => {
  it("wordForward at end returns end", () => {
    expect(wordForward("abc", 3)).toBe(3);
  });

  it("wordBackward at 0 returns 0", () => {
    expect(wordBackward("abc", 0)).toBe(0);
  });
});
