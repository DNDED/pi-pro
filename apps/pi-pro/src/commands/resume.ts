import { CheckpointStore } from "@pi/checkpoint";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function findLatestTaskId(checkpointsDir: string): Promise<string | null> {
  try {
    const entries = await readdir(checkpointsDir);
    if (entries.length === 0) return null;
    entries.sort();
    return entries[entries.length - 1];
  } catch {
    return null;
  }
}

export interface LatestCheckpoint {
  id: string;
  taskId: string;
  state: string;
  createdAt: string;
  payload: unknown;
}

export async function loadLatestCheckpoint(taskId: string, checkpointsDir: string): Promise<LatestCheckpoint | null> {
  const taskDir = join(checkpointsDir, taskId);
  let files: string[];
  try {
    files = (await readdir(taskDir)).filter(f => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  const raw = await readFile(join(taskDir, files[files.length - 1]), "utf8");
  const cp = JSON.parse(raw) as { id: string; taskId: string; state: string; createdAt: string; payload: unknown };
  return {
    id: cp.id,
    taskId: cp.taskId,
    state: cp.state,
    createdAt: cp.createdAt,
    payload: cp.payload,
  };
}

export async function resume(taskId?: string): Promise<void> {
  const store = new CheckpointStore();
  const checkpointsDir = ".pi-pro/checkpoints";
  const id = taskId ?? await findLatestTaskId(checkpointsDir);
  if (!id) {
    console.log("No tasks to resume.");
    return;
  }
  const latest = await loadLatestCheckpoint(id, checkpointsDir);
  if (!latest) {
    console.log(`No checkpoint found for ${id}.`);
    return;
  }
  console.log(`Resuming task ${id} from state '${latest.state}' (checkpoint ${latest.id}).`);
  console.log(`  state:   ${latest.state}`);
  console.log(`  created: ${latest.createdAt}`);
  console.log(`  payload: ${JSON.stringify(latest.payload)}`);
}
