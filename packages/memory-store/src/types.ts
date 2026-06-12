export type ChunkRole = "fact" | "preference" | "decision" | "code-symbol" | "narrative" | "transcript";

export const CHUNK_ROLES: ReadonlyArray<ChunkRole> = [
  "fact",
  "preference",
  "decision",
  "code-symbol",
  "narrative",
  "transcript",
];

export interface ChunkMeta {
  project?: string | null;
  source: string;
  role: ChunkRole;
}

export interface ChunkInput extends ChunkMeta {
  text: string;
  ts?: number;
  embedding?: Float32Array;
}

export interface Chunk {
  id: number;
  project: string | null;
  source: string;
  role: ChunkRole;
  text: string;
  embedding: Float32Array;
  ts: number;
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
  sources: ReadonlyArray<"vector" | "bm25" | "recency">;
}

export interface QueryOpts {
  project?: string | null;
  k?: number;
  recencyBoost?: number;
  bm25Weight?: number;
  filterRole?: ChunkRole;
  minScore?: number;
}

export interface MemoryStoreOpts {
  dbPath?: string;
  embeddings?: import("@pi/embeddings").EmbeddingsProvider;
}

export const DEFAULT_K = 10;
export const DEFAULT_RECENCY_BOOST = 0.1;
export const DEFAULT_BM25_WEIGHT = 0.3;
export const MIN_BM25_WEIGHT = 0;
export const MAX_BM25_WEIGHT = 1;
