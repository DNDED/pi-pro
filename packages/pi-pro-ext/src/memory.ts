import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export interface MemoryEntry {
  ts: number;
  role: "fact" | "preference" | "decision" | "narrative" | "transcript";
  text: string;
  source: string;
  project?: string;
}

export interface MemoryState {
  entries: MemoryEntry[];
  nextId: number;
}

export const INITIAL_MEMORY_STATE: MemoryState = {
  entries: [],
  nextId: 1,
};

function getMemoryPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "pi-pro", "memory.jsonl");
  return join(process.env.PI_HOME_OVERRIDE ?? homedir(), ".pi", "agent", "pi-pro-memory.jsonl");
}

export function loadMemoryState(path: string = getMemoryPath()): MemoryState {
  if (!existsSync(path)) return { entries: [], nextId: 1 };
  try {
    const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
    const entries: MemoryEntry[] = [];
    let nextId = 1;
    for (const line of lines) {
      try {
        const e = JSON.parse(line) as MemoryEntry;
        if (e && typeof e.ts === "number" && typeof e.text === "string") {
          entries.push(e);
          if (e.ts >= nextId) nextId = e.ts + 1;
        }
      } catch {
        // skip malformed
      }
    }
    return { entries, nextId };
  } catch {
    return { entries: [], nextId: 1 };
  }
}

export function saveMemoryState(state: MemoryState, path: string = getMemoryPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = state.entries.map((e) => JSON.stringify(e)).join("\n");
  writeFileSync(path, body + "\n", "utf8");
}

export function addMemory(
  state: MemoryState,
  text: string,
  role: MemoryEntry["role"] = "narrative",
  project?: string,
  path: string = getMemoryPath(),
): { state: MemoryState; entry: MemoryEntry } {
  const entry: MemoryEntry = {
    ts: state.nextId,
    role,
    text: text.trim(),
    source: `pi-pro:${Date.now()}:${state.nextId}`,
    project,
  };
  const next: MemoryState = {
    entries: [...state.entries, entry],
    nextId: state.nextId + 1,
  };
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // best-effort
  }
  return { state: next, entry };
}

export function searchMemory(state: MemoryState, query: string, k: number = 5): MemoryEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const matches: Array<{ entry: MemoryEntry; score: number }> = [];
  for (const e of state.entries) {
    const text = e.text.toLowerCase();
    let score = 0;
    if (text.includes(q)) score += 10;
    for (const word of q.split(/\s+/).filter(Boolean)) {
      if (word.length > 2 && text.includes(word)) score += 1;
    }
    if (e.project && q.includes(e.project.toLowerCase())) score += 1;
    if (score > 0) matches.push({ entry: e, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, k).map((m) => m.entry);
}

export function listMemory(state: MemoryState): MemoryEntry[] {
  return [...state.entries].sort((a, b) => b.ts - a.ts);
}

export function clearMemory(state: MemoryState): MemoryState {
  return { entries: [], nextId: 1 };
}
