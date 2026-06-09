import { SessionLog, type SessionEvent } from "@pi/tasks";

export function formatEventLine(event: SessionEvent): string {
  return `  [${event.ts}] ${event.state} :: ${event.event}${event.data ? " :: " + JSON.stringify(event.data) : ""}`;
}

export async function replay(taskId: string): Promise<void> {
  const log = new SessionLog();
  const events = await log.read(taskId);
  if (events.length === 0) {
    console.log(`No session log for task ${taskId}.`);
    return;
  }
  console.log(`Replaying ${events.length} events for ${taskId}:`);
  for (const e of events) {
    console.log(formatEventLine(e));
  }
}
