import { CheckpointStore } from "@pi/checkpoint";
import { readdir } from "node:fs/promises";

export async function resume(taskId?: string): Promise<void> {
  const store = new CheckpointStore();
  const id = taskId ?? await latestTaskId();
  if (!id) {
    console.log("No tasks to resume.");
    return;
  }
  const latest = await store.latest(id);
  if (!latest) {
    console.log(`No checkpoint found for ${id}.`);
    return;
  }
  console.log(`Resuming task ${id} from state '${latest.state}' (checkpoint ${latest.id}).`);
  console.log(`  state:   ${latest.state}`);
  console.log(`  created: ${latest.createdAt}`);
  console.log(`  payload: ${JSON.stringify(latest.payload)}`);
}

async function latestTaskId(): Promise<string | null> {
  const dir = ".pi-pro/checkpoints";
  try {
    const entries = await readdir(dir);
    if (entries.length === 0) return null;
    entries.sort();
    return entries[entries.length - 1];
  } catch {
    return null;
  }
}
