import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLatestTaskId, loadLatestCheckpoint } from "../src/commands/resume.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "resume-test-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const CHECKPOINTS_DIR = ".promyra/checkpoints";

async function writeCheckpoint(taskId: string, id: string, body: object): Promise<void> {
  const taskDir = join(dir, CHECKPOINTS_DIR, taskId);
  await mkdir(taskDir, { recursive: true });
  await writeFile(join(taskDir, `${id}.json`), JSON.stringify(body, null, 2));
}

function makeCheckpoint(taskId: string, id: string, state: string = "intake") {
  return {
    id,
    taskId,
    state,
    gitTreeSha: "abc1234",
    createdAt: new Date().toISOString(),
    payload: { foo: "bar" },
  };
}

describe("findLatestTaskId", () => {
  it("returns the only task in a single-task directory", async () => {
    await writeCheckpoint("tsk_aaa1111111", "chk_000001", makeCheckpoint("tsk_aaa1111111", "chk_000001"));
    const id = await findLatestTaskId(join(dir, CHECKPOINTS_DIR));
    expect(id).toBe("tsk_aaa1111111");
  });

  it("returns null in an empty directory", async () => {
    await mkdir(join(dir, CHECKPOINTS_DIR), { recursive: true });
    const id = await findLatestTaskId(join(dir, CHECKPOINTS_DIR));
    expect(id).toBeNull();
  });

  it("returns null when the directory does not exist", async () => {
    const id = await findLatestTaskId(join(dir, "no-such-dir"));
    expect(id).toBeNull();
  });

  it("returns the most recent (lexicographically last) task id in a multi-task directory", async () => {
    await writeCheckpoint("tsk_aaa1111111", "chk_000001", makeCheckpoint("tsk_aaa1111111", "chk_000001"));
    await writeCheckpoint("tsk_bbb2222222", "chk_000001", makeCheckpoint("tsk_bbb2222222", "chk_000001"));
    await writeCheckpoint("tsk_ccc3333333", "chk_000001", makeCheckpoint("tsk_ccc3333333", "chk_000001"));
    const id = await findLatestTaskId(join(dir, CHECKPOINTS_DIR));
    expect(id).toBe("tsk_ccc3333333");
  });
});

describe("loadLatestCheckpoint", () => {
  it("returns the full checkpoint for a single-task dir", async () => {
    const body = makeCheckpoint("tsk_aaa1111111", "chk_000001", "verify");
    await writeCheckpoint("tsk_aaa1111111", "chk_000001", body);
    const cp = await loadLatestCheckpoint("tsk_aaa1111111", join(dir, CHECKPOINTS_DIR));
    expect(cp).not.toBeNull();
    expect(cp!.id).toBe("chk_000001");
    expect(cp!.state).toBe("verify");
    expect(cp!.taskId).toBe("tsk_aaa1111111");
    expect(cp!.payload).toEqual({ foo: "bar" });
  });

  it("returns null when no checkpoints exist for the task", async () => {
    const cp = await loadLatestCheckpoint("tsk_nope", join(dir, CHECKPOINTS_DIR));
    expect(cp).toBeNull();
  });

  it("returns the most recent (lexicographically last) checkpoint for the task", async () => {
    await writeCheckpoint("tsk_aaa1111111", "chk_000001", makeCheckpoint("tsk_aaa1111111", "chk_000001", "intake"));
    await writeCheckpoint("tsk_aaa1111111", "chk_000002", makeCheckpoint("tsk_aaa1111111", "chk_000002", "verify"));
    const cp = await loadLatestCheckpoint("tsk_aaa1111111", join(dir, CHECKPOINTS_DIR));
    expect(cp).not.toBeNull();
    expect(cp!.id).toBe("chk_000002");
    expect(cp!.state).toBe("verify");
  });

  it("parses the payload as an object", async () => {
    const body = {
      ...makeCheckpoint("tsk_aaa1111111", "chk_000001"),
      payload: { nested: { a: 1 }, list: [1, 2, 3] },
    };
    await writeCheckpoint("tsk_aaa1111111", "chk_000001", body);
    const cp = await loadLatestCheckpoint("tsk_aaa1111111", join(dir, CHECKPOINTS_DIR));
    expect(cp!.payload).toEqual({ nested: { a: 1 }, list: [1, 2, 3] });
  });
});
