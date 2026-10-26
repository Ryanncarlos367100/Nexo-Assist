/**
 * ticket-service — serviço de chamados SIMULADO e isolado.
 *
 * Fronteira de negócio: o frontend NUNCA importa este módulo diretamente; ele é
 * acessado apenas por rotas de API (app/api/*) e pelas tools do agent. Toda
 * consulta é escopada pelo usuário autenticado (privacidade do Anexo A).
 *
 * Simula indisponibilidade ocasional (erro transitório) para forçar tratamento
 * de erro/retry. Operações são assíncronas para espelhar um serviço remoto real.
 */

import { getDb, ensureSeeded } from "@/db";
import { computeDueAt } from "@/agent/rules";
import type {
  Affected,
  Priority,
  Ticket,
  TicketCategory,
  TicketEvent,
  TicketEventType,
  TicketStatus,
  TicketType,
  UserRole,
} from "@/domain/types";
import {
  TicketAccessError,
  TicketNotFoundError,
  TicketValidationError,
  TransientServiceError,
} from "./errors";

export * from "./errors";

// ── Simulação de indisponibilidade ────────────────────────────────────────

/** Taxa de falha transitória (default 2%). Configurável p/ testes e demo. */
let failureRate =
  process.env.TICKET_SERVICE_FAILURE_RATE !== undefined
    ? Number(process.env.TICKET_SERVICE_FAILURE_RATE)
    : 0.02;

/** Ajusta a taxa de falha (0..1). Usado em testes para determinismo. */
export function setFailureRate(rate: number): void {
  failureRate = Math.min(1, Math.max(0, rate));
}

function maybeFail(): void {
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new TransientServiceError();
  }
}

// Pequeno atraso para espelhar I/O de rede (mantido curto p/ UX e testes).
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Contexto de autenticação / escopo ──────────────────────────────────────

export interface AuthContext {
  userId: string;
  role: UserRole;
}

function assertCanAccess(ctx: AuthContext, requesterId: string): void {
  // Analistas podem acessar chamados no console; funcionários, só os próprios.
  if (ctx.role === "analyst") return;
  if (requesterId !== ctx.userId) {
    throw new TicketAccessError();
  }
}

// ── Mapeamento de linha → domínio ──────────────────────────────────────────

interface TicketRow {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  subcategory: string | null;
  priority: Priority;
  affected: Affected;
  status: TicketStatus;
  requester_id: string;
  assigned_analyst_id: string | null;
  created_at: string;
  updated_at: string;
  due_at: string;
  resolved_at: string | null;
  overdue: number;
}

function rowToTicket(r: TicketRow): Ticket {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    category: r.category,
    subcategory: r.subcategory,
    priority: r.priority,
    affected: r.affected,
    status: r.status,
    requesterId: r.requester_id,
    assignedAnalystId: r.assigned_analyst_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    dueAt: r.due_at,
    resolvedAt: r.resolved_at,
    overdue: r.overdue === 1,
  };
}

function db() {
  ensureSeeded();
  return getDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function nextTicketId(type: TicketType): string {
  const d = db();
  const tx = d.transaction((t: TicketType): number => {
    const row = d.prepare("SELECT value FROM counters WHERE name = ?").get(t) as
      | { value: number }
      | undefined;
    const next = (row?.value ?? (t === "INC" ? 20000 : 10000)) + 1;
    d.prepare(
      "INSERT INTO counters(name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value",
    ).run(t, next);
    return next;
  });
  return `${type}-${tx(type)}`;
}

function recordEvent(
  ticketId: string,
  type: TicketEventType,
  message: string,
  actor: string,
): void {
  db()
    .prepare(
      `INSERT INTO ticket_events (ticket_id, type, message, actor, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(ticketId, type, message, actor, nowIso());
}

function getRow(id: string): TicketRow | undefined {
  return db().prepare("SELECT * FROM tickets WHERE id = ?").get(id) as
    | TicketRow
    | undefined;
}

// ── API pública ─────────────────────────────────────────────────────────────

/** Lista os chamados do funcionário autenticado (escopo de privacidade). */
export async function listTickets(ctx: AuthContext): Promise<Ticket[]> {
  await tick();
  maybeFail();
  const rows = db()
    .prepare(
      "SELECT * FROM tickets WHERE requester_id = ? ORDER BY datetime(created_at) DESC",
    )
    .all(ctx.userId) as TicketRow[];
  return rows.map(rowToTicket);
}

/**
 * Lista os chamados de um funcionário específico — restrito a analistas (usado
 * no console). Funcionários não podem acessar chamados de terceiros.
 */
export async function listTicketsByEmployee(
  ctx: AuthContext,
  employeeId: string,
): Promise<Ticket[]> {
  await tick();
  maybeFail();
  if (ctx.role !== "analyst") throw new TicketAccessError();
  const rows = db()
    .prepare(
      "SELECT * FROM tickets WHERE requester_id = ? ORDER BY datetime(created_at) DESC",
    )
    .all(employeeId) as TicketRow[];
  return rows.map(rowToTicket);
}

/** Lista apenas os chamados abertos (não resolvidos) do funcionário. */
export async function listOpenTickets(ctx: AuthContext): Promise<Ticket[]> {
  const all = await listTickets(ctx);
  return all.filter((t) => t.status !== "resolved");
}

/** Busca um chamado por id, respeitando o escopo do solicitante. */
export async function getTicket(ctx: AuthContext, id: string): Promise<Ticket> {
  await tick();
  maybeFail();
  const row = getRow(id);
  if (!row) throw new TicketNotFoundError(id);
  assertCanAccess(ctx, row.requester_id);
  return rowToTicket(row);
}

export interface CreateTicketInput {
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  subcategory?: string | null;
  priority: Priority;
  affected: Affected;
  /** Analista a atribuir (opcional). */
  assignedAnalystId?: string | null;
}

/** Cria um chamado para o funcionário autenticado. Calcula o prazo via SLA. */
export async function createTicket(
  ctx: AuthContext,
  input: CreateTicketInput,
  actorName = "Nexo Assist",
): Promise<Ticket> {
  await tick();
  maybeFail();
  if (!input.title.trim()) throw new TicketValidationError("Título é obrigatório.");
  if (!input.description.trim())
    throw new TicketValidationError("Descrição é obrigatória.");

  const id = nextTicketId(input.type);
  const createdAt = nowIso();
  const dueAt = computeDueAt(new Date(createdAt), input.priority).toISOString();

  db()
    .prepare(
      `INSERT INTO tickets (id, type, title, description, category, subcategory, priority, affected,
         status, requester_id, assigned_analyst_id, created_at, updated_at, due_at, resolved_at, overdue)
       VALUES (@id, @type, @title, @description, @category, @subcategory, @priority, @affected,
         @status, @requesterId, @assignedAnalystId, @createdAt, @updatedAt, @dueAt, NULL, 0)`,
    )
    .run({
      id,
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      subcategory: input.subcategory ?? null,
      priority: input.priority,
      affected: input.affected,
      status: "open" as TicketStatus,
      requesterId: ctx.userId,
      assignedAnalystId: input.assignedAnalystId ?? null,
      createdAt,
      updatedAt: createdAt,
      dueAt,
    });

  recordEvent(id, "created", "Chamado aberto.", actorName);
  return rowToTicket(getRow(id)!);
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  category?: TicketCategory;
  subcategory?: string | null;
  priority?: Priority;
  affected?: Affected;
  status?: TicketStatus;
  assignedAnalystId?: string | null;
}

/** Atualiza um chamado existente (evita duplicidade: ver detectDuplicate). */
export async function updateTicket(
  ctx: AuthContext,
  id: string,
  patch: UpdateTicketInput,
  actorName = "Nexo Assist",
  note = "Chamado atualizado.",
): Promise<Ticket> {
  await tick();
  maybeFail();
  const row = getRow(id);
  if (!row) throw new TicketNotFoundError(id);
  assertCanAccess(ctx, row.requester_id);

  const updatedAt = nowIso();
  // Recalcula prazo se a prioridade mudou.
  const dueAt =
    patch.priority && patch.priority !== row.priority
      ? computeDueAt(new Date(updatedAt), patch.priority).toISOString()
      : row.due_at;

  db()
    .prepare(
      `UPDATE tickets SET
         title = @title, description = @description, category = @category,
         subcategory = @subcategory, priority = @priority, affected = @affected,
         status = @status, assigned_analyst_id = @assignedAnalystId,
         updated_at = @updatedAt, due_at = @dueAt, overdue = @overdue
       WHERE id = @id`,
    )
    .run({
      id,
      title: patch.title ?? row.title,
      description: patch.description ?? row.description,
      category: patch.category ?? row.category,
      subcategory: patch.subcategory !== undefined ? patch.subcategory : row.subcategory,
      priority: patch.priority ?? row.priority,
      affected: patch.affected ?? row.affected,
      status: patch.status ?? row.status,
      assignedAnalystId:
        patch.assignedAnalystId !== undefined
          ? patch.assignedAnalystId
          : row.assigned_analyst_id,
      updatedAt,
      dueAt,
      // Atualizar "zera" o vencimento (houve resposta/atualização).
      overdue: 0,
    });

  recordEvent(id, "updated", note, actorName);
  return rowToTicket(getRow(id)!);
}

/**
 * Reabre um chamado resolvido (permitido até 7 dias — validação de janela fica
 * na camada de regras/agent; aqui apenas efetua a reabertura).
 */
export async function reopenTicket(
  ctx: AuthContext,
  id: string,
  actorName = "Nexo Assist",
): Promise<Ticket> {
  await tick();
  maybeFail();
  const row = getRow(id);
  if (!row) throw new TicketNotFoundError(id);
  assertCanAccess(ctx, row.requester_id);
  if (row.status !== "resolved") {
    throw new TicketValidationError("Só é possível reabrir um chamado resolvido.");
  }

  const updatedAt = nowIso();
  const dueAt = computeDueAt(new Date(updatedAt), row.priority).toISOString();
  db()
    .prepare(
      `UPDATE tickets SET status = 'in_progress', resolved_at = NULL,
         updated_at = @updatedAt, due_at = @dueAt, overdue = 0 WHERE id = @id`,
    )
    .run({ id, updatedAt, dueAt });

  recordEvent(id, "reopened", "Chamado reaberto.", actorName);
  return rowToTicket(getRow(id)!);
}

/** Transfere o chamado para a fila de um analista. */
export async function transferTicket(
  ctx: AuthContext,
  id: string,
  options: { analystTier?: string; summary?: string } = {},
  actorName = "Nexo Assist",
): Promise<Ticket> {
  await tick();
  maybeFail();
  const row = getRow(id);
  if (!row) throw new TicketNotFoundError(id);
  assertCanAccess(ctx, row.requester_id);

  const updatedAt = nowIso();
  db()
    .prepare(
      `UPDATE tickets SET status = 'awaiting_analyst', updated_at = @updatedAt WHERE id = @id`,
    )
    .run({ id, updatedAt });

  const tier = options.analystTier ?? "Suporte N2";
  const summary = options.summary ? ` Resumo: ${options.summary}` : "";
  recordEvent(id, "transferred", `Transferido para ${tier}.${summary}`, actorName);
  return rowToTicket(getRow(id)!);
}

/** Marca um chamado como vencido (usado por varredura de SLA). */
export async function markOverdue(id: string): Promise<Ticket> {
  await tick();
  maybeFail();
  const row = getRow(id);
  if (!row) throw new TicketNotFoundError(id);
  db().prepare("UPDATE tickets SET overdue = 1 WHERE id = ?").run(id);
  recordEvent(id, "marked_overdue", "Chamado marcado como vencido (SLA estourado).", "Sistema");
  return rowToTicket(getRow(id)!);
}

/** Varredura: marca como vencidos todos os chamados fora do prazo. */
export async function sweepOverdue(now: Date = new Date()): Promise<string[]> {
  await tick();
  const rows = db()
    .prepare(
      "SELECT id, status, due_at FROM tickets WHERE status != 'resolved' AND overdue = 0",
    )
    .all() as { id: string; status: string; due_at: string }[];
  const marked: string[] = [];
  for (const r of rows) {
    if (now.getTime() > new Date(r.due_at).getTime()) {
      db().prepare("UPDATE tickets SET overdue = 1 WHERE id = ?").run(r.id);
      recordEvent(r.id, "marked_overdue", "Chamado marcado como vencido.", "Sistema");
      marked.push(r.id);
    }
  }
  return marked;
}

/** Histórico/auditoria de um chamado. */
export async function getTicketEvents(
  ctx: AuthContext,
  id: string,
): Promise<TicketEvent[]> {
  await tick();
  maybeFail();
  const row = getRow(id);
  if (!row) throw new TicketNotFoundError(id);
  assertCanAccess(ctx, row.requester_id);
  const events = db()
    .prepare(
      "SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY datetime(created_at) ASC, id ASC",
    )
    .all(id) as {
    id: number;
    ticket_id: string;
    type: TicketEventType;
    message: string;
    actor: string;
    created_at: string;
  }[];
  return events.map((e) => ({
    id: e.id,
    ticketId: e.ticket_id,
    type: e.type,
    message: e.message,
    actor: e.actor,
    createdAt: e.created_at,
  }));
}

// ── Retry helper (tratamento de erro transitório) ──────────────────────────

export interface RetryOptions {
  retries?: number;
  delayMs?: number;
}

/**
 * Executa uma operação do ticket-service com retry em erros TRANSITÓRIOS.
 * Erros de negócio (acesso, não encontrado, validação) NÃO são retentados.
 */
export async function withRetry<T>(
  op: () => Promise<T>,
  { retries = 3, delayMs = 60 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastError = err;
      if (!(err instanceof TransientServiceError)) throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
