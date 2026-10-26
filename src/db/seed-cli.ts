/**
 * Script CLI: garante que o banco exista e esteja semeado.
 *   npm run db:seed
 */
import { getDb, ensureSeeded, closeDb } from "./index";

function main(): void {
  getDb();
  ensureSeeded();
  const db = getDb();
  const users = db.prepare("SELECT COUNT(*) AS c FROM users").get() as {
    c: number;
  };
  const tickets = db.prepare("SELECT COUNT(*) AS c FROM tickets").get() as {
    c: number;
  };
  const articles = db
    .prepare("SELECT COUNT(*) AS c FROM help_articles")
    .get() as { c: number };
  console.log(
    `Banco pronto: ${users.c} usuários, ${tickets.c} chamados, ${articles.c} artigos.`,
  );
  closeDb();
}

main();
