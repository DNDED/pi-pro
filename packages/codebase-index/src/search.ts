import type { MemoryStore } from "@pi/memory-store";
import type { CodeIndexEntry, CodeSearchOpts, CodeSearchResult } from "./types.js";
import { DEFAULT_REGEX_BOOST } from "./types.js";
import type { Chunk } from "@pi/memory-store";

const CODE_SOURCE_PREFIX = "code:";

export async function searchCodebase(
  store: MemoryStore,
  query: string,
  opts: CodeSearchOpts = {},
): Promise<CodeSearchResult[]> {
  const k = opts.k ?? 10;
  const regexBoost = clamp01(opts.regexBoost ?? DEFAULT_REGEX_BOOST);
  const minScore = opts.minScore ?? 0;
  const project = undefined;

  const all = await store.query(query, {
    k: Math.max(k * 3, 30),
    project,
    filterRole: "code-symbol",
  });

  const queryTerms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);

  const results: CodeSearchResult[] = [];

  for (const r of all) {
    const entry = chunkToEntry(r.chunk);
    if (opts.pathPrefix && !entry.file.startsWith(opts.pathPrefix)) continue;
    let vectorScore = 0;
    let regexScore = 0;
    let matchedBy: "regex" | "vector" | "both" = "vector";

    if (r.sources.includes("vector")) {
      const cos = vectorCosSimFromSources(r.chunk, store);
      vectorScore = cos;
    }

    if (queryTerms.length > 0) {
      const text = `${entry.name} ${entry.signature} ${entry.file}`.toLowerCase();
      let hits = 0;
      for (const t of queryTerms) {
        if (text.includes(t)) hits++;
      }
      regexScore = queryTerms.length > 0 ? hits / queryTerms.length : 0;
    }

    if (regexScore > 0) {
      matchedBy = vectorScore > 0 ? "both" : "regex";
    }

    const final = (1 - regexBoost) * vectorScore + regexBoost * regexScore;
    if (final < minScore) continue;

    results.push({ entry, score: final, matchedBy });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

function chunkToEntry(c: Chunk): CodeIndexEntry {
  return {
    id: c.id,
    file: extractFile(c.source),
    line: extractLine(c.source),
    kind: extractMeta(c.text, "kind") ?? "symbol",
    signature: c.text.split("\n")[0] ?? c.text,
    name: extractNameFromText(c.text) ?? "",
    source: c.source,
    text: c.text,
  };
}

function extractFile(source: string): string {
  if (!source.startsWith(CODE_SOURCE_PREFIX)) return source;
  const rest = source.slice(CODE_SOURCE_PREFIX.length);
  const lastColon = rest.lastIndexOf(":");
  return lastColon > 0 ? rest.slice(0, lastColon) : rest;
}

function extractLine(source: string): number {
  if (!source.startsWith(CODE_SOURCE_PREFIX)) return 0;
  const rest = source.slice(CODE_SOURCE_PREFIX.length);
  const lastColon = rest.lastIndexOf(":");
  if (lastColon < 0) return 0;
  return Number(rest.slice(lastColon + 1)) || 0;
}

function extractMeta(text: string, _key: string): string | undefined {
  return undefined;
}

function extractNameFromText(text: string): string | undefined {
  const m = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(text);
  if (m) return m[1];
  const c = /^export\s+class\s+([A-Za-z_$][\w$]*)/.exec(text);
  if (c) return c[1];
  const v = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(text);
  if (v) return v[1];
  return undefined;
}

function vectorCosSimFromSources(_chunk: Chunk, _store: MemoryStore): number {
  return 0.5;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
