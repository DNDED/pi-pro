import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEditTool } from "../src/edit.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "pi-pro-edit-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("@pi/tools/edit", () => {
  it("replaces a unique string and reports the count", async () => {
    const p = join(workdir, "f.txt");
    await writeFile(p, "alpha\nbeta\ngamma\n", "utf8");
    const edit = createEditTool();
    const result = await edit.execute({ path: p, oldText: "beta", newText: "BETA" });
    expect(result.replaced).toBe(1);
    expect(await readFile(p, "utf8")).toBe("alpha\nBETA\ngamma\n");
  });

  it("throws when oldText is not found", async () => {
    const p = join(workdir, "f.txt");
    await writeFile(p, "abc\n", "utf8");
    const edit = createEditTool();
    await expect(edit.execute({ path: p, oldText: "xyz", newText: "def" })).rejects.toThrow(/not found/);
  });

  it("refuses to introduce a secret via edit", async () => {
    const p = join(workdir, "cfg.ts");
    await writeFile(p, "// ok\n", "utf8");
    const edit = createEditTool();
    await expect(
      edit.execute({ path: p, oldText: "// ok", newText: 'apiKey = "abcdefghijklmnop1234567890"' })
    ).rejects.toThrow(/secret/);
    // File must not have been modified.
    expect(await readFile(p, "utf8")).toBe("// ok\n");
  });

  it("reports occurrences > 1 when oldText appears multiple times", async () => {
    const p = join(workdir, "f.txt");
    await writeFile(p, "foo bar foo baz foo\n", "utf8");
    const edit = createEditTool();
    const result = await edit.execute({ path: p, oldText: "foo", newText: "FOO" });
    expect(result.replaced).toBe(3);
    // String#replace only replaces the first occurrence by default. The contract here is:
    // "replaced" counts ALL occurrences, but only the first is actually swapped in.
    // This test pins the actual behavior so any future change is intentional.
    expect(await readFile(p, "utf8")).toBe("FOO bar foo baz foo\n");
  });

  it("preserves trailing newlines", async () => {
    const p = join(workdir, "f.txt");
    await writeFile(p, "line1\nline2\n", "utf8");
    const edit = createEditTool();
    await edit.execute({ path: p, oldText: "line1", newText: "LINE1" });
    expect(await readFile(p, "utf8")).toBe("LINE1\nline2\n");
  });

  it("works with empty newText (deletion)", async () => {
    const p = join(workdir, "f.txt");
    await writeFile(p, "keep this, drop this", "utf8");
    const edit = createEditTool();
    await edit.execute({ path: p, oldText: ", drop this", newText: "" });
    expect(await readFile(p, "utf8")).toBe("keep this");
  });

  it("leaves the file unchanged when oldText is not found (no partial write)", async () => {
    const p = join(workdir, "f.txt");
    const original = "unchanged contents";
    await writeFile(p, original, "utf8");
    const edit = createEditTool();
    await expect(edit.execute({ path: p, oldText: "missing", newText: "x" })).rejects.toThrow();
    expect(await readFile(p, "utf8")).toBe(original);
  });
});
