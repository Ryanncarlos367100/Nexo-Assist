/**
 * Script CLI: apaga o arquivo SQLite e recria tudo do zero com dados de exemplo.
 *   npm run db:reset
 */
import { existsSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { getDb, ensureSeeded, closeDb } from "./index";

function dbPath(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/nexo.db";
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function main(): void {
  closeDb();
  const base = dbPath();
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = base + suffix;
    if (existsSync(file)) rmSync(file);
  }
  getDb();
  ensureSeeded();
  console.log("Banco recriado e semeado do zero.");
  closeDb();
}

main();
