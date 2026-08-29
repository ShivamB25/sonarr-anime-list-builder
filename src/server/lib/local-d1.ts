import { mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";

type BoundValue = string | number | boolean | null | Uint8Array;

type LocalD1Result = {
  results: Record<string, unknown>[];
  success: true;
  meta: Record<string, unknown>;
};

class LocalD1PreparedStatement {
  private params: BoundValue[] = [];

  constructor(
    private readonly db: Database,
    private readonly sql: string
  ) {}

  bind(...params: BoundValue[]) {
    const statement = new LocalD1PreparedStatement(this.db, this.sql);
    statement.params = params;
    return statement;
  }

  all(): LocalD1Result {
    const results = this.db.query(this.sql).all(...this.params) as Record<
      string,
      unknown
    >[];
    return { results, success: true, meta: {} };
  }

  raw(): unknown[][] {
    return this.db.query(this.sql).values(...this.params) as unknown[][];
  }

  run(): LocalD1Result {
    this.db.query(this.sql).run(...this.params);
    return { results: [], success: true, meta: {} };
  }
}

export type LocalD1Database = {
  prepare(sql: string): LocalD1PreparedStatement;
  batch(statements: LocalD1PreparedStatement[]): Promise<LocalD1Result[]>;
};

export function createLocalD1Database(dbPath: string): LocalD1Database {
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA foreign_keys = ON");

  return {
    prepare(sql: string) {
      return new LocalD1PreparedStatement(db, sql);
    },
    async batch(statements: LocalD1PreparedStatement[]) {
      const results: LocalD1Result[] = [];
      db.transaction(() => {
        for (const statement of statements) {
          results.push(statement.run());
        }
      })();
      return results;
    },
  };
}

export async function migrateLocalD1Database(
  d1: LocalD1Database,
  migrationsDir: string
) {
  await d1.prepare("CREATE TABLE IF NOT EXISTS __local_migrations (name TEXT PRIMARY KEY)").run();

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const existing = await d1
      .prepare("SELECT name FROM __local_migrations WHERE name = ?")
      .bind(file)
      .all();

    if (existing.results.length > 0) continue;

    const sql = await Bun.file(join(migrationsDir, file)).text();
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    await d1.batch([
      ...statements.map((statement) => d1.prepare(statement)),
      d1
        .prepare("INSERT INTO __local_migrations (name) VALUES (?)")
        .bind(file),
    ]);
  }
}

export async function ensureSqliteDirectory(dbPath: string) {
  await mkdir(dirname(dbPath), { recursive: true });
}
