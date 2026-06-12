import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReadTool } from "../src/read.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "promyra-read-"));
});

afterEach(async () => {
  // tmpdir is OS-managed; vitest cleans it via OS eventually. Use force-rm to avoid stale.
  const { rm } = await import("node:fs/promises");
  await rm(workdir, { recursive: true, force: true });
});

describe("@promyra/tools/read", () => {
  it("returns the file contents as a string", async () => {
    const p = join(workdir, "hello.txt");
    await writeFile(p, "hello world", "utf8");
    const read = createReadTool({ cwd: workdir });
    const result = await read.execute({ path: p });
    expect(result).toBe("hello world");
  });

  it("refuses to read a path outside the working dir", async () => {
    const read = createReadTool({ cwd: workdir });
    await expect(read.execute({ path: "/etc/passwd" })).rejects.toThrow(/outside working dir/);
  });

  it("surfaces a missing-file error", async () => {
    const p = join(workdir, "does-not-exist.txt");
    const read = createReadTool({ cwd: workdir });
    await expect(read.execute({ path: p })).rejects.toThrow();
  });

  it("does not execute shell metacharacters embedded in path", async () => {
    const evil = join(workdir, "innocent.txt; echo PWNED");
    await writeFile(join(workdir, "innocent.txt"), "safe", "utf8");
    const read = createReadTool({ cwd: workdir });
    // The file is missing, but what matters is that PWNED never gets executed.
    await expect(read.execute({ path: evil })).rejects.toThrow();
    // No side-effect file should appear at the literal joined path with semicolon.
    const exists = await readFile(join(workdir, "PWNED"), "utf8").then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it("reads a binary file and returns a string (no throw)", async () => {
    const p = join(workdir, "blob.bin");
    // NUL bytes and high-bit chars — typical binary content.
    const buf = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x00, 0x80, 0x7f]);
    await writeFile(p, buf);
    const read = createReadTool({ cwd: workdir });
    const out = await read.execute({ path: p });
    // Contract: returns a string. May contain U+FFFD replacement chars for invalid utf8 sequences;
    // the point is that the tool does NOT throw on binary content.
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});
