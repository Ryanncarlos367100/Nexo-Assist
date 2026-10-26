/**
 * directory — consultas de usuários (funcionários e analistas). Isolado para
 * que auth, agent e console não falem com a tabela de usuários diretamente.
 */

import { getDb, ensureSeeded } from "@/db";
import type { User, UserRole } from "@/domain/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string | null;
  analyst_tier: string | null;
  password_changed_at: string;
  avatar_initials: string;
}

function rowToUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    department: r.department,
    analystTier: r.analyst_tier,
    passwordChangedAt: r.password_changed_at,
    avatarInitials: r.avatar_initials,
  };
}

function db() {
  ensureSeeded();
  return getDb();
}

export function getUser(id: string): User | null {
  const row = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserByEmail(email: string): User | null {
  const row = db()
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .get(email.trim()) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

/** Valida credenciais (demo: comparação direta de senha — ver README). */
export function verifyCredentials(email: string, password: string): User | null {
  const row = db()
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .get(email.trim()) as UserRow | undefined;
  if (!row) return null;
  if (row.password !== password) return null;
  return rowToUser(row);
}

export function listAnalysts(): User[] {
  const rows = db()
    .prepare("SELECT * FROM users WHERE role = 'analyst' ORDER BY name")
    .all() as UserRow[];
  return rows.map(rowToUser);
}
