import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { PoolClient, QueryResultRow } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export function defaultDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgres://ops:ops@localhost:5432/ops";
}

/**
 * Thin Postgres handle: plain queries run on the pool; queries issued inside
 * `transact` run on the transaction's client, carried via AsyncLocalStorage
 * so repositories stay unaware of transaction boundaries.
 */
export interface Db {
  query<R extends QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: R[]; rowCount: number }>;
  transact<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function openDatabase(databaseUrl: string): Db {
  const pool = new Pool({ connectionString: databaseUrl });
  const txStorage = new AsyncLocalStorage<PoolClient>();
  return {
    async query<R extends QueryResultRow>(
      text: string,
      params: readonly unknown[] = [],
    ) {
      const client = txStorage.getStore() ?? pool;
      const result = await client.query<R>(text, params as unknown[]);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
    async transact<T>(fn: () => Promise<T>): Promise<T> {
      if (txStorage.getStore()) {
        return fn();
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await txStorage.run(client, fn);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function migrate(db: Db): Promise<void> {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const { rows } = await db.query<{ name: string }>(
    "SELECT name FROM schema_migrations",
  );
  const applied = new Set(rows.map((row) => row.name));
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await db.transact(async () => {
      await db.query(sql);
      await db.query(
        "INSERT INTO schema_migrations (name, applied_at) VALUES ($1, $2)",
        [file, new Date().toISOString()],
      );
    });
  }
}
