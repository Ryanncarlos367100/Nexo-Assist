/**
 * Sessão simples baseada em cookie assinado (HMAC). Suficiente para o escopo do
 * desafio: identifica o usuário autenticado e permite escopar as consultas de
 * chamado por usuário (privacidade). Não é um sistema de auth de produção.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getUser } from "@/services/directory";
import type { AuthContext } from "@/services/ticket-service";
import type { User } from "@/domain/types";

const COOKIE_NAME = "nexo_session";

function secret(): string {
  return process.env.SESSION_SECRET ?? "nexo-dev-secret-trocar-em-producao";
}

function sign(userId: string): string {
  const mac = createHmac("sha256", secret()).update(userId).digest("hex");
  return `${userId}.${mac}`;
}

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = createHmac("sha256", secret()).update(userId).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function createSession(userId: string, remember: boolean): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // "Manter conectado" → 30 dias; sessão volátil caso contrário.
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Usuário autenticado na requisição atual, ou null. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  return getUser(userId);
}

/** Contexto de autenticação (userId + role) para o ticket-service, ou null. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { userId: user.id, role: user.role };
}
