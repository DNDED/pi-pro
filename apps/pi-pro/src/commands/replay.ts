import { SessionLog } from "@pi/tasks";

export async function replay(taskId: string): Promise<void> {
  const log = new SessionLog();
  const events = await log.read(taskId);
  if (events.length === 0) {
    console.log(`No session log for task ${taskId}.`);
    return;
  }
  console.log(`Replaying ${events.length} events for ${taskId}:\n`);
  for (const e of events) {
    console.log(`  [${e.ts}] ${e.state} :: ${e.event}${e.data ? " :: " + JSON.stringify(e.data) : ""}`);
  }
}
