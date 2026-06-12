import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { getRepoMap, type Symbol } from "@pi/repo-map";
import type { CodeIndexEntry, CodeIndexBuildResult, CodeIndexOpts } from "./types.js";
import { DEFAULT_CODE_INDEX_SOURCE_PREFIX } from "./types.js";

const SUPPORTED_EXTS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "rb"]);

const DEFAULT_EXCLUDE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".pi-pro",
  "target",
];

function globMatch(name: string, pattern: string): boolean {
  if (!pattern.includes("*")) return name === pattern;
  const re = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$",
  );
  return re.test(name);
}

function isExcluded(relPath: string, excludes: string[]): boolean {
  const parts = relPath.split("/");
  for (const part of parts) {
    for (const ex of excludes) {
      if (globMatch(part, ex)) return true;
    }
  }
  return false;
}

export async function scanAndIndex(
  rootDir: string,
  opts: CodeIndexOpts,
): Promise<CodeIndexBuildResult> {
  const excludes = opts.repoMapOpts?.excludeGlobs ?? DEFAULT_EXCLUDE;
  const sourcePrefix = opts.sourcePrefix ?? DEFAULT_CODE_INDEX_SOURCE_PREFIX;

  const map = await getRepoMap(rootDir, "", opts.repoMapOpts);

  const errors: string[] = [];
  const entries: Array<{ entry: Omit<CodeIndexEntry, "id">; symbol: Symbol }> = [];
  let filesScanned = 0;

  for await (const abs of walkFiles(rootDir, excludes, [])) {
    const ext = extname(abs).slice(1);
    if (!SUPPORTED_EXTS.has(ext)) continue;
    filesScanned++;
    let content: string;
    try {
      content = await readFile(abs, "utf8");
    } catch (e) {
      errors.push(`read ${abs}: ${(e as Error).message}`);
      continue;
    }
    const rel = relative(rootDir, abs);
    const lines = content.split("\n");
    for (const sym of map.topSymbols) {
      if (sym.symbol.file !== rel) continue;
      const lineText = lines[sym.symbol.line - 1] ?? "";
      const text = `${sym.symbol.signature}\n${lineText}`.trim();
      entries.push({
        entry: {
          file: rel,
          line: sym.symbol.line,
          kind: sym.symbol.kind,
          signature: sym.symbol.signature,
          name: sym.symbol.name,
          source: `${sourcePrefix}:${rel}:${sym.symbol.line}`,
          text,
        },
        symbol: sym.symbol,
      });
    }
  }

  if (opts.memoryStore.listSources(opts.project ?? undefined).some((s) => s.startsWith(`${sourcePrefix}:`))) {
    for (const s of opts.memoryStore.listSources(opts.project ?? undefined)) {
      if (s.startsWith(`${sourcePrefix}:`)) opts.memoryStore.deleteBySource(s);
    }
  }

  const inputs = entries.map((e) => ({
    project: opts.project ?? null,
    source: e.entry.source,
    role: "code-symbol" as const,
    text: e.entry.text,
  }));

  await opts.memoryStore.addChunks(inputs);

  return {
    scannedFiles: filesScanned,
    symbolsFound: entries.length,
    symbolsIndexed: entries.length,
    errors,
  };
}

async function* walkFiles(
  root: string,
  excludes: string[],
  includeGlobs: string[],
): AsyncGenerator<string> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const abs = join(root, name);
    const rel = relative(root, abs);
    if (isExcluded(rel, excludes)) continue;
    if (includeGlobs.length > 0 && !includeGlobs.some((g) => globMatch(rel, g))) continue;
    let s;
    try {
      s = await stat(abs);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      yield* walkFiles(abs, excludes, includeGlobs);
    } else if (s.isFile()) {
      yield abs;
    }
  }
}
