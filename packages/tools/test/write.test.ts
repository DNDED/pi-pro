import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWriteTool } from "../src/write.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "promyra-write-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("@promyra/tools/write", () => {
  it("creates a new file with the given content", async () => {
    const p = join(workdir, "out.txt");
    const write = createWriteTool();
    await write.execute({ path: p, content: "first content" });
    expect(await readFile(p, "utf8")).toBe("first content");
  });

  it("creates missing parent directories recursively", async () => {
    const p = join(workdir, "deep/nested/dir/file.txt");
    const write = createWriteTool();
    await write.execute({ path: p, content: "nested" });
    expect(await readFile(p, "utf8")).toBe("nested");
  });

  it("overwrites an existing file", async () => {
    const p = join(workdir, "x.txt");
    await writeFile(p, "old", "utf8");
    const write = createWriteTool();
    await write.execute({ path: p, content: "new" });
    expect(await readFile(p, "utf8")).toBe("new");
  });

  it("succeeds with empty content", async () => {
    const p = join(workdir, "empty.txt");
    const write = createWriteTool();
    await write.execute({ path: p, content: "" });
    expect(await readFile(p, "utf8")).toBe("");
  });

  it("refuses to write a file containing a hardcoded secret", async () => {
    const p = join(workdir, "cfg.ts");
    const write = createWriteTool();
    await expect(
      write.execute({ path: p, content: 'apiKey = "abcdefghijklmnop1234567890"' })
    ).rejects.toThrow(/secret/);
    // The file must not have been created.
    const exists = await readFile(p, "utf8").then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it("refuses to write to a read-only path", async () => {
    const p = join(workdir, "ro.txt");
    await writeFile(p, "init", "utf8");
    await chmod(p, 0o444);
    // We have to restore permissions in cleanup or the rm call may fail on some systems.
    const write = createWriteTool();
    try {
      await expect(write.execute({ path: p, content: "nope" })).rejects.toThrow();
    } finally {
      await chmod(p, 0o644).catch(() => {});
    }
  });

  it("scans the entire content, not just the first line, for secrets", async () => {
    const p = join(workdir, "mixed.ts");
    const write = createWriteTool();
    const content = [
      "import x from 'y';",
      "// this comment is fine",
      'apiKey = "abcdefghijklmnop1234567890"',
    ].join("\n");
    await expect(write.execute({ path: p, content })).rejects.toThrow(/secret/);
  });
});
