import { MemoryStore } from "@pi/memory-store";
import { defaultEmbeddings } from "@pi/embeddings";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";

export const DEFAULT_MEMORY_DB = join(homedir(), ".pi-pro", "memory.db");

export function defaultMemoryPath(): string {
  if (process.env.PROMYRA_HOME_OVERRIDE) {
    return join(process.env.PROMYRA_HOME_OVERRIDE, "memory.db");
  }
  return DEFAULT_MEMORY_DB;
}

export interface MemoryCmdOpts {
  project?: string;
  source?: string;
  role?: string;
  k?: number;
}

export async function memoryAdd(text: string, opts: MemoryCmdOpts = {}): Promise<{ id: number; source: string }> {
  const path = defaultMemoryPath();
  mkdirSync(join(path, ".."), { recursive: true });
  const store = new MemoryStore({ dbPath: path, embeddings: defaultEmbeddings() });
  const source = opts.source ?? `cli:${new Date().toISOString().slice(0, 10)}`;
  const role = (opts.role ?? "narrative") as "fact" | "preference" | "decision" | "code-symbol" | "narrative" | "transcript";
  const id = await store.addChunk({ project: opts.project ?? null, source, role, text });
  store.close();
  return { id, source };
}

export async function memorySearch(query: string, opts: MemoryCmdOpts = {}): Promise<Array<{ score: number; source: string; role: string; text: string }>> {
  const path = defaultMemoryPath();
  const store = new MemoryStore({ dbPath: path, embeddings: defaultEmbeddings() });
  const results = await store.query(query, {
    k: opts.k ?? 5,
    project: opts.project,
    filterRole: opts.role as "fact" | "preference" | "decision" | "code-symbol" | "narrative" | "transcript" | undefined,
  });
  const out = results.map((r) => ({
    score: r.score,
    source: r.chunk.source,
    role: r.chunk.role,
    text: r.chunk.text,
  }));
  store.close();
  return out;
}

export function memoryList(opts: MemoryCmdOpts = {}): Array<{ source: string; count: number }> {
  const path = defaultMemoryPath();
  const store = new MemoryStore({ dbPath: path, embeddings: defaultEmbeddings() });
  const sources = store.listSources(opts.project);
  const out = sources.map((s) => ({ source: s, count: 0 }));
  store.close();
  return out;
}

export function memoryForget(source: string, opts: MemoryCmdOpts = {}): number {
  const path = defaultMemoryPath();
  const store = new MemoryStore({ dbPath: path, embeddings: defaultEmbeddings() });
  const removed = store.deleteBySource(source);
  store.close();
  return removed;
}

export function memoryCount(opts: MemoryCmdOpts = {}): number {
  const path = defaultMemoryPath();
  const store = new MemoryStore({ dbPath: path, embeddings: defaultEmbeddings() });
  const n = store.count({
    project: opts.project,
    role: opts.role as "fact" | "preference" | "decision" | "code-symbol" | "narrative" | "transcript" | undefined,
  });
  store.close();
  return n;
}

export function formatMemoryResults(results: Array<{ score: number; source: string; role: string; text: string }>): string {
  if (results.length === 0) return "  (no results)";
  const lines: string[] = [];
  for (const r of results) {
    const pct = (r.score * 100).toFixed(0).padStart(3);
    const src = r.source.padEnd(40).slice(0, 40);
    const role = r.role.padEnd(11).slice(0, 11);
    const snippet = r.text.length > 60 ? r.text.slice(0, 57) + "..." : r.text;
    lines.push(`  ${pct}%  ${src}  ${role}  ${snippet}`);
  }
  return lines.join("\n");
}
