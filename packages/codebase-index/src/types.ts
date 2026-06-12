import type { MemoryStore } from "@pi/memory-store";
import type { EmbeddingsProvider } from "@pi/embeddings";
import type { RepoMapOpts } from "@pi/repo-map";

export interface CodeIndexEntry {
  id: number;
  file: string;
  line: number;
  kind: string;
  signature: string;
  name: string;
  source: string;
  text: string;
}

export interface CodeIndexOpts {
  memoryStore: MemoryStore;
  embeddings?: EmbeddingsProvider;
  repoMapOpts?: RepoMapOpts;
  project?: string | null;
  sourcePrefix?: string;
}

export interface CodeSearchOpts {
  k?: number;
  pathPrefix?: string;
  regexBoost?: number;
  minScore?: number;
}

export interface CodeSearchResult {
  entry: CodeIndexEntry;
  score: number;
  matchedBy: "regex" | "vector" | "both";
}

export interface CodeIndexBuildResult {
  scannedFiles: number;
  symbolsFound: number;
  symbolsIndexed: number;
  errors: string[];
}

export const DEFAULT_REGEX_BOOST = 0.3;
export const DEFAULT_CODE_INDEX_SOURCE_PREFIX = "code";
