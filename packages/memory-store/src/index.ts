export { MemoryStore } from "./store.js";
export { openDb } from "./db.js";
export type { DbHandle } from "./db.js";
export { tokenize, embedToBuffer, bufferToEmbed, indexMarkdown, bm25Score } from "./util.js";
export type {
  Chunk,
  ChunkInput,
  ChunkMeta,
  ChunkRole,
  MemoryStoreOpts,
  QueryOpts,
  ScoredChunk,
} from "./types.js";
export { CHUNK_ROLES, DEFAULT_K, DEFAULT_RECENCY_BOOST, DEFAULT_BM25_WEIGHT } from "./types.js";
