import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SessionEvent, SessionEventSchema } from "./types.js";

const SESSIONS_DIR = ".promyra/sessions";

export class SessionLog {
  constructor(private readonly rootDir: string = process.cwd()) {}

  private path(taskId: string): string {
    return join(this.rootDir, SESSIONS_DIR, `${taskId}.jsonl`);
  }

  async append(taskId: string, event: Omit<SessionEvent, "ts">): Promise<SessionEvent> {
    await mkdir(join(this.rootDir, SESSIONS_DIR), { recursive: true });
    const full: SessionEvent = SessionEventSchema.parse({ ...event, ts: new Date().toISOString() });
    await writeFile(this.path(taskId), JSON.stringify(full) + "\n", { flag: "a" });
    return full;
  }

  async read(taskId: string): Promise<SessionEvent[]> {
    if (!existsSync(this.path(taskId))) return [];
    const raw = await readFile(this.path(taskId), "utf8");
    return raw.trim().split("\n").filter(Boolean).map(l => SessionEventSchema.parse(JSON.parse(l)));
  }
}
