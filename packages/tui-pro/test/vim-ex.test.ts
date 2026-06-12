import { describe, it, expect } from "vitest";
import {
  parseEx,
  applyEx,
  handleKey,
  handleExKey,
  INITIAL_RUNTIME,
  type VimRuntime,
  type ExCommand,
} from "../src/index.js";

function inNormal(s: string): VimRuntime {
  let r: VimRuntime = {
    ...INITIAL_RUNTIME,
    state: { ...INITIAL_RUNTIME.state, text: s, cursor: s.length, mode: "insert" },
  };
  r = handleKey("", { escape: true }, r);
  return r;
}

function k(input: string, key: Record<string, boolean> = {}): [string, Record<string, boolean>] {
  return [input, key];
}

function runKeys(runtime: VimRuntime, keys: Array<[string, Record<string, boolean>]>): VimRuntime {
  let r = runtime;
  for (const [i, k2] of keys) r = handleKey(i, k2, r);
  return r;
}

describe("parseEx", () => {
  it("parses :w", () => {
    expect(parseEx(":w").kind).toBe("write");
  });

  it("parses :write", () => {
    expect(parseEx(":write").kind).toBe("write");
  });

  it("parses :q", () => {
    expect(parseEx(":q").kind).toBe("quit");
  });

  it("parses :quit", () => {
    expect(parseEx(":quit").kind).toBe("quit");
  });

  it("parses :wq", () => {
    expect(parseEx(":wq").kind).toBe("write-quit");
  });

  it("parses :x", () => {
    expect(parseEx(":x").kind).toBe("write-quit");
  });

  it("parses :q!", () => {
    const r = parseEx(":q!");
    expect(r.kind).toBe("force-quit");
    expect(r.bang).toBe(true);
  });

  it("parses :clear", () => {
    expect(parseEx(":clear").kind).toBe("clear");
  });

  it("parses :cls (alias)", () => {
    expect(parseEx(":cls").kind).toBe("clear");
  });

  it("parses :help", () => {
    expect(parseEx(":help").kind).toBe("help");
  });

  it("parses :? (alias for help)", () => {
    expect(parseEx(":?").kind).toBe("help");
  });

  it("parses empty as none", () => {
    expect(parseEx("").kind).toBe("none");
    expect(parseEx(":").kind).toBe("none");
  });

  it("parses unknown as none", () => {
    expect(parseEx(":foo").kind).toBe("none");
  });

  it("preserves raw input", () => {
    expect(parseEx(":w").raw).toBe(":w");
    expect(parseEx(":  write  ").raw).toBe(":  write  ");
  });

  it("strips bang from non-q commands", () => {
    expect(parseEx(":w!").bang).toBe(false);
  });
});

describe("applyEx", () => {
  it("returns state unchanged for none command", () => {
    const state = { ...INITIAL_RUNTIME.state, text: "abc" };
    const result = applyEx(state, { kind: "none", raw: "", bang: false });
    expect(result.state.text).toBe("abc");
  });

  it("clears text on :clear", () => {
    const state = { ...INITIAL_RUNTIME.state, text: "abc", cursor: 3, mode: "normal" as const };
    const result = applyEx(state, { kind: "clear", raw: ":clear", bang: false });
    expect(result.state.text).toBe("");
    expect(result.state.cursor).toBe(0);
    expect(result.state.mode).toBe("insert");
  });

  it("preserves quit / write / help commands for caller to handle", () => {
    const state = INITIAL_RUNTIME.state;
    const cmd: ExCommand = { kind: "quit", raw: ":q", bang: false };
    const result = applyEx(state, cmd);
    expect(result.state.text).toBe(INITIAL_RUNTIME.state.text);
    expect(result.command.kind).toBe("quit");
  });
});

describe("handleExKey — entry and typing", () => {
  it("`:` in normal mode enters ex mode with exBuf=':'", () => {
    const r = inNormal("hello");
    const next = handleKey(":", {}, r);
    expect(next.state.mode).toBe("ex");
    expect(next.state.exBuf).toBe(":");
  });

  it("typing in ex mode appends to exBuf", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("w")]);
    expect(r.state.exBuf).toBe(":w");
    expect(r.state.mode).toBe("ex");
  });

  it("typing more chars accumulates", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("w"), k("r"), k("i"), k("t"), k("e")]);
    expect(r.state.exBuf).toBe(":write");
  });
});

describe("handleExKey — escape and backspace", () => {
  it("escape returns to normal mode and clears exBuf", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("w"), k("", { escape: true })]);
    expect(r.state.mode).toBe("normal");
    expect(r.state.exBuf).toBe("");
  });

  it("backspace removes last char from exBuf", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("w"), k("q"), k("", { backspace: true })]);
    expect(r.state.exBuf).toBe(":w");
  });

  it("backspace on ':' alone returns to normal mode", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("", { backspace: true })]);
    expect(r.state.mode).toBe("normal");
    expect(r.state.exBuf).toBe("");
  });
});

describe("handleExKey — enter executes command", () => {
  it(":w + enter sets lastExCommand and returns to normal", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("w"), k("", { return: true })]);
    expect(r.state.mode).toBe("normal");
    expect(r.state.exBuf).toBe("");
    expect(r.state.lastExCommand.kind).toBe("write");
  });

  it(":clear + enter clears text", () => {
    const r = runKeys(inNormal("hello world"), [k(":"), k("c"), k("l"), k("e"), k("a"), k("r"), k("", { return: true })]);
    expect(r.state.text).toBe("");
    expect(r.state.lastExCommand.kind).toBe("clear");
  });

  it(":q + enter sets lastExCommand to quit (state preserved)", () => {
    const r = runKeys(inNormal("important text"), [k(":"), k("q"), k("", { return: true })]);
    expect(r.state.text).toBe("important text");
    expect(r.state.lastExCommand.kind).toBe("quit");
  });

  it(":help + enter sets lastExCommand to help", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("h"), k("e"), k("l"), k("p"), k("", { return: true })]);
    expect(r.state.lastExCommand.kind).toBe("help");
  });

  it("unknown command returns to normal without action", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("f"), k("o"), k("o"), k("", { return: true })]);
    expect(r.state.mode).toBe("normal");
    expect(r.state.lastExCommand.kind).toBe("none");
  });
});

describe("handleExKey — full flow", () => {
  it("type :q! in normal mode then enter", () => {
    const r = runKeys(inNormal("hello"), [k(":"), k("q"), k("!"), k("", { return: true })]);
    expect(r.state.lastExCommand.kind).toBe("force-quit");
    expect(r.state.lastExCommand.bang).toBe(true);
  });
});
