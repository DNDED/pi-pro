import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatEventLine, replay } from "../src/commands/replay.js";
import type { SessionEvent } from "@pi/tasks";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "replay-test-"));
  process.env.PI_PRO_HOME_OVERRIDE = dir;
});
afterEach(async () => {
  delete process.env.PI_PRO_HOME_OVERRIDE;
  await rm(dir, { recursive: true, force: true });
});

function captureStdout(fn: () => Promise<void> | void): Promise<string> {
  const origWrite = process.stdout.write.bind(process.stdout);
  const origLog = console.log;
  let buf = "";
  (process.stdout as any).write = (chunk: string | Buffer) => {
    buf += chunk.toString();
    return true;
  };
  console.log = (...args: unknown[]) => {
    buf += args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ") + "\n";
  };
  return Promise.resolve(fn()).finally(() => {
    (process.stdout as any).write = origWrite;
    console.log = origLog;
    return Promise.resolve();
  }).then(() => buf);
}

function makeEvent(over: Partial<SessionEvent> = {}): SessionEvent {
  return {
    ts: "2025-01-01T00:00:00.000Z",
    state: "intake",
    event: "transition",
    ...over,
  };
}

describe("formatEventLine", () => {
  it("includes the ISO timestamp in brackets", () => {
    const line = formatEventLine(makeEvent({ ts: "2025-01-01T00:00:00.000Z" }));
    expect(line).toContain("[2025-01-01T00:00:00.000Z]");
  });

  it("includes the state name", () => {
    const line = formatEventLine(makeEvent({ state: "verify" }));
    expect(line).toContain("verify");
  });

  it("includes the event name", () => {
    const line = formatEventLine(makeEvent({ event: "checkpoint" }));
    expect(line).toContain("checkpoint");
  });

  it("formats a transition event with from/to via data", () => {
    const line = formatEventLine(makeEvent({
      state: "plan",
      event: "transition",
      data: { from: "intake", to: "plan" },
    }));
    expect(line).toContain("transition");
    expect(line).toContain("plan");
  });

  it("formats a checkpoint event with id and gitTreeSha in data", () => {
    const line = formatEventLine(makeEvent({
      state: "execute",
      event: "checkpoint",
      data: { id: "chk_000001", gitTreeSha: "abc1234" },
    }));
    expect(line).toContain("checkpoint");
    expect(line).toContain("chk_000001");
    expect(line).toContain("abc1234");
  });

  it("formats a step-done event with stepId in data", () => {
    const line = formatEventLine(makeEvent({
      state: "execute",
      event: "step-done",
      data: { stepId: "execute" },
    }));
    expect(line).toContain("step-done");
    expect(line).toContain("execute");
  });

  it("omits data serialization when data is undefined", () => {
    const line = formatEventLine(makeEvent({ event: "transition" }));
    expect(line).not.toContain(":: undefined");
    expect(line).not.toContain("null");
  });

  it("includes serialized data when present", () => {
    const line = formatEventLine(makeEvent({
      event: "checkpoint",
      data: { id: "chk_000007" },
    }));
    expect(line).toContain("chk_000007");
  });
});

describe("replay orchestrator (uses process.cwd())", () => {
  it("prints 'No session log' for a task with no events in an empty tmpdir", async () => {
    // SessionLog uses process.cwd() — vitest workers don't allow chdir, but a fresh tmpdir
    // *is* the test's cwd (or at least there is no .pi-pro/sessions for this task).
    const out = await captureStdout(() => replay("tsk_definitely_does_not_exist_xx"));
    expect(out).toMatch(/No session log/);
  });
});
