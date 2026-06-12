import { readdir } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, sep, posix } from "node:path";
import picomatch from "picomatch";

export interface GlobOpts {
  cwd?: string;
  maxDepth?: number;
  dot?: boolean;
}

export interface GlobTool {
  name: "glob";
  description: string;
  input_schema: {
    type: "object";
    properties: { pattern: { type: "string" }; path?: { type: "string" } };
    required: ["pattern"];
  };
  execute(input: { pattern: string; path?: string }): Promise<{ files: string[] }>;
}

const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", ".promyra"]);

function toPosix(p: string): string {
  return p.split(sep).join(posix.sep);
}

export function createGlobTool(opts: GlobOpts = {}): GlobTool {
  const cwd = opts.cwd ?? process.cwd();
  const maxDepth = opts.maxDepth ?? 6;
  const dot = opts.dot ?? false;
  return {
    name: "glob",
    description: "Find files matching a glob pattern (picomatch). Supports *, ?, [abc], {a,b}, **, and case-sensitive matches.",
    input_schema: {
      type: "object",
      properties: { pattern: { type: "string" }, path: { type: "string" } },
      required: ["pattern"],
    },
    async execute({ pattern, path }) {
      const root = path ? (isAbsolute(path) ? path : resolve(cwd, path)) : cwd;
      const matcher = picomatch(pattern, { dot, matchBase: false });
      const out: string[] = [];
      await walk(root, root, matcher, out, 0, maxDepth);
      return { files: out };
    },
  };
}

async function walk(
  dir: string,
  root: string,
  matcher: (s: string) => boolean,
  out: string[],
  depth: number,
  maxDepth: number,
): Promise<void> {
  if (depth > maxDepth) return;
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      await walk(full, root, matcher, out, depth + 1, maxDepth);
    } else if (e.isFile()) {
      const rel = toPosix(relative(root, full));
      if (matcher(rel)) out.push(rel);
    }
  }
}
