import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { seedDatabase } from "./seed";

/**
 * Conexão SQLite singleton (better-sqlite3), compartilhada entre hot-reloads do
 * Next em desenvolvimento via globalThis. A migração do schema é idempotente e
 * o seed roda automaticamente quando o banco está vazio.
 */

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "schema.sql");

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/nexo.db";
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function createConnection(): Database.Database {
  const dbPath = resolveDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);

  return db;
}

type DbGlobal = typeof globalThis & {
  __nexoDb?: Database.Database;
  __nexoSeeded?: boolean;
};

const g = globalThis as DbGlobal;

export function getDb(): Database.Database {
  if (!g.__nexoDb) {
    g.__nexoDb = createConnection();
  }
  return g.__nexoDb;
}

/**
 * Garante que o banco tenha dados de exemplo. Seguro de chamar múltiplas vezes:
 * só semeia quando a tabela de usuários está vazia.
 */
export function ensureSeeded(): void {
  if (g.__nexoSeeded) return;
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS c FROM users").get() as {
    c: number;
  };
  if (row.c === 0) {
    seedDatabase(db);
  }
  g.__nexoSeeded = true;
}

/** Fecha e descarta a conexão (usado por scripts CLI de reset). */
export function closeDb(): void {
  if (g.__nexoDb) {
    g.__nexoDb.close();
    g.__nexoDb = undefined;
    g.__nexoSeeded = false;
  }
}
