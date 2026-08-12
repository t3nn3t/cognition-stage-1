import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type SqliteDatabase = Database.Database;

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export function defaultDbPath(): string {
  return process.env.OPS_CONSOLE_DB_PATH ?? path.join("data", "ops.sqlite");
}

export function openDatabase(dbPath: string): SqliteDatabase {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db: SqliteDatabase): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    db
      .prepare("SELECT name FROM schema_migrations")
      .all()
      .map((row) => (row as { name: string }).name),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
      ).run(file, new Date().toISOString());
    })();
  }
}
