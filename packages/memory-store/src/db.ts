import Database from "better-sqlite3";

export interface DbHandle {
  raw: Database.Database;
  close: () => void;
}

export function openDb(dbPath: string): DbHandle {
  const raw = new Database(dbPath);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("synchronous = NORMAL");
  migrate(raw);
  return {
    raw,
    close: () => raw.close(),
  };
}

const SCHEMA_VERSION = 1;

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const row = db
    .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  const current = row ? Number(row.value) : 0;
  if (current < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project    TEXT,
        source     TEXT NOT NULL,
        role       TEXT NOT NULL,
        text       TEXT NOT NULL,
        embedding  BLOB NOT NULL,
        ts         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project);
      CREATE INDEX IF NOT EXISTS idx_chunks_source  ON chunks(source);
      CREATE INDEX IF NOT EXISTS idx_chunks_ts      ON chunks(ts);
      CREATE INDEX IF NOT EXISTS idx_chunks_role    ON chunks(role);
    `);
    db.prepare("INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)").run(
      String(SCHEMA_VERSION),
    );
  }
}
