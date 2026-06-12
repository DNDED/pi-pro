import type {
  Chunk,
  ChunkInput,
  MemoryStoreOpts,
  QueryOpts,
  ScoredChunk,
} from "./types.js";
import { DEFAULT_BM25_WEIGHT, DEFAULT_K, DEFAULT_RECENCY_BOOST } from "./types.js";
import { openDb, type DbHandle } from "./db.js";
import { tokenize, embedToBuffer, bufferToEmbed, bm25Score } from "./util.js";
import { NullEmbeddings, type EmbeddingsProvider, cosineSimilarity } from "@pi/embeddings";

interface Row {
  id: number;
  project: string | null;
  source: string;
  role: string;
  text: string;
  embedding: Buffer;
  ts: number;
}

function rowToChunk(row: Row): Chunk {
  return {
    id: row.id,
    project: row.project,
    source: row.source,
    role: row.role as Chunk["role"],
    text: row.text,
    embedding: bufferToEmbed(row.embedding),
    ts: row.ts,
  };
}

export class MemoryStore {
  private readonly db: DbHandle;
  private readonly embeddings: EmbeddingsProvider;
  private readonly ownsDb: boolean;

  constructor(opts: MemoryStoreOpts = {}) {
    const dbPath = opts.dbPath ?? ":memory:";
    this.db = openDb(dbPath);
    this.ownsDb = true;
    this.embeddings = opts.embeddings ?? new NullEmbeddings();
  }

  static fromDb(db: DbHandle, opts: { embeddings?: EmbeddingsProvider } = {}): MemoryStore {
    const store = Object.create(MemoryStore.prototype) as MemoryStore;
    (store as unknown as { db: DbHandle }).db = db;
    (store as unknown as { embeddings: EmbeddingsProvider }).embeddings = opts.embeddings ?? new NullEmbeddings();
    (store as unknown as { ownsDb: boolean }).ownsDb = false;
    return store;
  }

  get provider(): EmbeddingsProvider {
    return this.embeddings;
  }

  get dbHandle(): DbHandle {
    return this.db;
  }

  async addChunk(input: ChunkInput): Promise<number> {
    const ts = input.ts ?? Date.now();
    const embedding = input.embedding ?? (await this.embeddings.embed(input.text));
    const stmt = this.db.raw.prepare(
      "INSERT INTO chunks (project, source, role, text, embedding, ts) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const info = stmt.run(input.project ?? null, input.source, input.role, input.text, embedToBuffer(embedding), ts);
    return Number(info.lastInsertRowid);
  }

  async addChunks(inputs: ChunkInput[]): Promise<number[]> {
    if (inputs.length === 0) return [];
    const prepared: Array<{ project: string | null; source: string; role: string; text: string; embedding: Buffer; ts: number }> = [];
    for (const r of inputs) {
      const ts = r.ts ?? Date.now();
      const embedding = r.embedding ?? (await this.embeddings.embed(r.text));
      prepared.push({
        project: r.project ?? null,
        source: r.source,
        role: r.role,
        text: r.text,
        embedding: embedToBuffer(embedding),
        ts,
      });
    }
    const stmt = this.db.raw.prepare(
      "INSERT INTO chunks (project, source, role, text, embedding, ts) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertAll = this.db.raw.transaction((rows: typeof prepared) => {
      const ids: number[] = [];
      for (const row of rows) {
        const info = stmt.run(row.project, row.source, row.role, row.text, row.embedding, row.ts);
        ids.push(Number(info.lastInsertRowid));
      }
      return ids;
    });
    return insertAll(prepared);
  }

  getChunk(id: number): Chunk | null {
    const row = this.db.raw
      .prepare("SELECT id, project, source, role, text, embedding, ts FROM chunks WHERE id = ?")
      .get(id) as Row | undefined;
    return row ? rowToChunk(row) : null;
  }

  deleteChunk(id: number): boolean {
    const info = this.db.raw.prepare("DELETE FROM chunks WHERE id = ?").run(id);
    return info.changes > 0;
  }

  deleteBySource(source: string): number {
    const info = this.db.raw.prepare("DELETE FROM chunks WHERE source = ?").run(source);
    return info.changes;
  }

  deleteByProject(project: string): number {
    const info = this.db.raw.prepare("DELETE FROM chunks WHERE project = ?").run(project);
    return info.changes;
  }

  count(filter?: { project?: string | null; role?: Chunk["role"] }): number {
    if (!filter) {
      const row = this.db.raw.prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number };
      return row.n;
    }
    const where: string[] = [];
    const args: unknown[] = [];
    if (filter.project !== undefined) {
      where.push("project IS ?");
      args.push(filter.project);
    }
    if (filter.role !== undefined) {
      where.push("role = ?");
      args.push(filter.role);
    }
    const sql = `SELECT COUNT(*) AS n FROM chunks${where.length ? " WHERE " + where.join(" AND ") : ""}`;
    const row = this.db.raw.prepare(sql).get(...args) as { n: number };
    return row.n;
  }

  listSources(project?: string | null): string[] {
    let rows: Array<{ source: string }>;
    if (project === undefined) {
      rows = this.db.raw
        .prepare("SELECT DISTINCT source FROM chunks ORDER BY source")
        .all() as Array<{ source: string }>;
    } else {
      rows = this.db.raw
        .prepare("SELECT DISTINCT source FROM chunks WHERE project IS ? ORDER BY source")
        .all(project) as Array<{ source: string }>;
    }
    return rows.map((r) => r.source);
  }

  async query(query: string, opts: QueryOpts = {}): Promise<ScoredChunk[]> {
    const k = opts.k ?? DEFAULT_K;
    const bm25Weight = clamp01(opts.bm25Weight ?? DEFAULT_BM25_WEIGHT);
    const recencyBoost = clamp01(opts.recencyBoost ?? DEFAULT_RECENCY_BOOST);
    const vectorWeight = 1 - bm25Weight;
    const minScore = opts.minScore ?? 0;

    const projectFilter = opts.project === undefined ? undefined : opts.project;
    const roleFilter = opts.filterRole;

    const rows = this.fetchRows({ project: projectFilter, role: roleFilter });
    if (rows.length === 0) return [];

    const queryEmbedding = await this.maybeEmbed(query);
    const queryTerms = tokenize(query);
    const now = Date.now();

    const docTermsList: string[][] = [];
    const docFreqs = new Map<string, number>();
    for (const r of rows) {
      const terms = tokenize(r.text);
      docTermsList.push(terms);
      const seen = new Set<string>();
      for (const t of terms) {
        if (seen.has(t)) continue;
        seen.add(t);
        docFreqs.set(t, (docFreqs.get(t) ?? 0) + 1);
      }
    }
    const avgDocLen = docTermsList.reduce((s, t) => s + t.length, 0) / docTermsList.length;
    const totalDocs = rows.length;

    const scored: ScoredChunk[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const chunk = rowToChunk(row);
      const sources: Array<"vector" | "bm25" | "recency"> = [];

      let vectorScore = 0;
      if (queryEmbedding && queryEmbedding.length > 0 && chunk.embedding.length > 0) {
        vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (vectorScore > 0.05) sources.push("vector");
      } else if (bm25Weight >= 1) {
        vectorScore = 0;
      } else {
        vectorScore = 0;
      }

      let bm25 = 0;
      if (bm25Weight > 0 && queryTerms.length > 0) {
        bm25 = bm25Score(queryTerms, docTermsList[i], avgDocLen, docFreqs, totalDocs);
        if (bm25 > 0) sources.push("bm25");
      }

      const ageMs = Math.max(0, now - chunk.ts);
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recency = Math.exp(-ageDays / 30);
      if (recency > 0.5) sources.push("recency");

      const base = vectorWeight * normalize01(vectorScore) + bm25Weight * normalize01(bm25);
      const score = (1 - recencyBoost) * base + recencyBoost * recency;

      if (score < minScore) continue;

      scored.push({ chunk, score, sources });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  close(): void {
    if (this.ownsDb) this.db.close();
  }

  private fetchRows(filter: { project: string | null | undefined; role?: Chunk["role"] }): Row[] {
    const where: string[] = [];
    const args: unknown[] = [];
    if (filter.project !== undefined) {
      if (filter.project === null) {
        where.push("project IS NULL");
      } else {
        where.push("project IS ?");
        args.push(filter.project);
      }
    }
    if (filter.role !== undefined) {
      where.push("role = ?");
      args.push(filter.role);
    }
    const sql = `SELECT id, project, source, role, text, embedding, ts FROM chunks${
      where.length ? " WHERE " + where.join(" AND ") : ""
    }`;
    return this.db.raw.prepare(sql).all(...args) as Row[];
  }

  private async maybeEmbed(text: string): Promise<Float32Array | null> {
    if (this.embeddings instanceof NullEmbeddings) return null;
    if (this.embeddings.dim === 0) return null;
    try {
      return await this.embeddings.embed(text);
    } catch {
      return null;
    }
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalize01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}
