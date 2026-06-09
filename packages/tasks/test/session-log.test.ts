import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionLog } from "../src/session-log.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "pi-pro-session-log-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("@pi/tasks/session-log", () => {
  it("creates the log file on first append", async () => {
    const log = new SessionLog(workdir);
    await log.append("tsk_aaa", { state: "intake", event: "started", data: {} });
    const raw = await readFile(join(workdir, ".pi-pro/sessions", "tsk_aaa.jsonl"), "utf8");
    expect(raw).toContain("\"state\":\"intake\"");
  });

  it("appends multiple events as separate lines", async () => {
    const log = new SessionLog(workdir);
    await log.append("tsk_bbb", { state: "intake", event: "started", data: {} });
    await log.append("tsk_bbb", { state: "plan", event: "advanced", data: {} });
    const raw = await readFile(join(workdir, ".pi-pro/sessions", "tsk_bbb.jsonl"), "utf8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("\"state\":\"intake\"");
    expect(lines[1]).toContain("\"state\":\"plan\"");
  });

  it("read returns parsed events with all required fields", async () => {
    const log = new SessionLog(workdir);
    await log.append("tsk_ccc", { state: "execute", event: "tool", data: { name: "bash" } });
    const events = await log.read("tsk_ccc");
    expect(events).toHaveLength(1);
    expect(events[0].state).toBe("execute");
    expect(events[0].event).toBe("tool");
    expect(events[0].data).toEqual({ name: "bash" });
    expect(typeof events[0].ts).toBe("string");
  });

  it("read returns an empty array when the log file does not exist", async () => {
    const log = new SessionLog(workdir);
    const events = await log.read("tsk_never_appended");
    expect(events).toEqual([]);
  });

  it("read parses back exactly what was appended", async () => {
    const log = new SessionLog(workdir);
    await log.append("tsk_ddd", { state: "intake", event: "a", data: { x: 1 } });
    await log.append("tsk_ddd", { state: "plan", event: "b", data: { y: 2 } });
    await log.append("tsk_ddd", { state: "branch", event: "c", data: { z: 3 } });
    const events = await log.read("tsk_ddd");
    expect(events.map(e => e.state)).toEqual(["intake", "plan", "branch"]);
  });

  it("read on a malformed line throws (Zod validation fails)", async () => {
    const log = new SessionLog(workdir);
    // Create the sessions dir then write a single line of garbage.
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(workdir, ".pi-pro/sessions"), { recursive: true });
    await writeFile(
      join(workdir, ".pi-pro/sessions", "tsk_bad.jsonl"),
      "{not valid json\n",
      "utf8"
    );
    await expect(log.read("tsk_bad")).rejects.toThrow();
  });

  it("two logs under the same root are isolated by taskId", async () => {
    const log = new SessionLog(workdir);
    await log.append("tsk_one", { state: "intake", event: "a", data: {} });
    await log.append("tsk_two", { state: "plan", event: "b", data: {} });
    const a = await log.read("tsk_one");
    const b = await log.read("tsk_two");
    expect(a.map(e => e.state)).toEqual(["intake"]);
    expect(b.map(e => e.state)).toEqual(["plan"]);
  });
});
