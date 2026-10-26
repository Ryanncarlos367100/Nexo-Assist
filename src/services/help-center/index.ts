/**
 * help-center — busca simples por palavras-chave nos artigos da central de ajuda.
 *
 * Implementação intencionalmente leve (ranking por sobreposição de termos), sem
 * dependência de FTS nativo, para manter o projeto fácil de ler e rodar. A
 * pontuação pondera palavras-chave > título > corpo.
 */

import { getDb, ensureSeeded } from "@/db";
import type { HelpArticle, TicketCategory } from "@/domain/types";

interface ArticleRow {
  id: string;
  title: string;
  body: string;
  category: TicketCategory;
  keywords: string; // JSON array
  os_scope: string | null;
}

function rowToArticle(r: ArticleRow): HelpArticle {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    keywords: JSON.parse(r.keywords) as string[],
    osScope: r.os_scope,
  };
}

function db() {
  ensureSeeded();
  return getDb();
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length >= 3);
}

export interface ArticleSearchHit {
  article: HelpArticle;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  category?: TicketCategory;
}

/**
 * Busca artigos relevantes para uma consulta em linguagem natural.
 * Retorna hits ordenados por relevância (score > 0).
 */
export function searchArticles(
  query: string,
  { limit = 3, category }: SearchOptions = {},
): ArticleSearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const rows = (
    category
      ? (db()
          .prepare("SELECT * FROM help_articles WHERE category = ?")
          .all(category) as ArticleRow[])
      : (db().prepare("SELECT * FROM help_articles").all() as ArticleRow[])
  ).map(rowToArticle);

  const hits: ArticleSearchHit[] = [];
  for (const article of rows) {
    const kw = new Set(article.keywords.map(normalize));
    const titleTokens = new Set(tokenize(article.title));
    const bodyNorm = normalize(article.body);

    let score = 0;
    for (const term of terms) {
      if (kw.has(term)) score += 3;
      if (titleTokens.has(term)) score += 2;
      if (bodyNorm.includes(term)) score += 1;
    }
    // Correspondência de frase inteira em keyword (ex: "erro 809").
    const q = normalize(query);
    for (const k of kw) {
      if (k.length >= 4 && q.includes(k)) score += 2;
    }

    if (score > 0) hits.push({ article, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export function getArticle(id: string): HelpArticle | null {
  const row = db().prepare("SELECT * FROM help_articles WHERE id = ?").get(id) as
    | ArticleRow
    | undefined;
  return row ? rowToArticle(row) : null;
}

export function listArticles(): HelpArticle[] {
  const rows = db().prepare("SELECT * FROM help_articles").all() as ArticleRow[];
  return rows.map(rowToArticle);
}
