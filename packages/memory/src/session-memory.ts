import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { ContextEntry } from "./types.js";

const MEMORY_FILE = ".pi-pro/memory.md";

export class SessionMemory {
  constructor(private readonly rootDir: string = process.cwd()) {}

  private path(): string { return join(this.rootDir, MEMORY_FILE); }

  async read(): Promise<string> {
    if (!existsSync(this.path())) return "";
    return readFile(this.path(), "utf8");
  }

  async write(content: string): Promise<void> {
    await mkdir(dirname(this.path()), { recursive: true });
    await writeFile(this.path(), content, "utf8");
  }

  async appendLearning(entry: ContextEntry): Promise<void> {
    const current = await this.read();
    const section = `\n## Learning (${entry.ts})\n\n${entry.body}\n`;
    const next = current + section;
    await this.write(next);
  }

  async appendContext(entry: ContextEntry): Promise<void> {
    const current = await this.read();
    const section = `\n## Context (${entry.ts})\n\n${entry.body}\n`;
    const next = current + section;
    await this.write(next);
  }

  async getLearnings(): Promise<ContextEntry[]> {
    const raw = await this.read();
    return parseSection(raw, /^## Learning \(([^)]+)\)/);
  }

  async getContext(): Promise<ContextEntry[]> {
    const raw = await this.read();
    return parseSection(raw, /^## Context \(([^)]+)\)/);
  }

  async clear(): Promise<void> {
    await this.write("");
  }
}

function parseSection(raw: string, headerRe: RegExp): ContextEntry[] {
  const lines = raw.split("\n");
  const out: ContextEntry[] = [];
  let current: ContextEntry | null = null;
  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      if (current) out.push(current);
      current = { ts: m[1], source: "intake", body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) out.push(current);
  return out.map(e => ({ ...e, body: e.body.trim() }));
}
