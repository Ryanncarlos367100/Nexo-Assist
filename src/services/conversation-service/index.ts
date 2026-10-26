/**
 * conversation-service — persistência de conversas e mensagens do chat.
 * Usado pelo engine do agent e pelo console do analista.
 */

import { getDb, ensureSeeded } from "@/db";
import { randomUUID } from "node:crypto";
import type {
  Conversation,
  ConversationStatus,
  Message,
  MessageMeta,
  MessageRole,
} from "@/domain/types";

function db() {
  ensureSeeded();
  return getDb();
}
function nowIso(): string {
  return new Date().toISOString();
}

interface ConversationRow {
  id: string;
  employee_id: string;
  status: ConversationStatus;
  assigned_analyst_id: string | null;
  confidence: number;
  transfer_note: string | null;
  unread_count: number;
  agent_state: string | null;
  related_ticket_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    employeeId: r.employee_id,
    status: r.status,
    assignedAnalystId: r.assigned_analyst_id,
    confidence: r.confidence,
    transferNote: r.transfer_note,
    unreadCount: r.unread_count,
    relatedTicketId: r.related_ticket_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  author_name: string | null;
  content: string;
  meta: string | null;
  created_at: string;
}

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    authorName: r.author_name,
    content: r.content,
    meta: r.meta ? (JSON.parse(r.meta) as MessageMeta) : null,
    createdAt: r.created_at,
  };
}

export function getConversation(id: string): Conversation | null {
  const row = db().prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | ConversationRow
    | undefined;
  return row ? rowToConversation(row) : null;
}

/**
 * Conversa ATIVA com o agent (status 'agent') mais recente do funcionário.
 * Conversas pausadas (transferidas/com analista) não são reutilizadas no chat
 * do funcionário — elas seguem no console até o analista encerrar. Assim o
 * funcionário sempre tem o agent pronto para um novo assunto.
 */
export function getActiveConversationForEmployee(
  employeeId: string,
): Conversation | null {
  const row = db()
    .prepare(
      `SELECT * FROM conversations WHERE employee_id = ? AND status = 'agent'
       ORDER BY datetime(updated_at) DESC LIMIT 1`,
    )
    .get(employeeId) as ConversationRow | undefined;
  return row ? rowToConversation(row) : null;
}

export function createConversation(employeeId: string): Conversation {
  const id = `conv-${randomUUID().slice(0, 8)}`;
  const now = nowIso();
  db()
    .prepare(
      `INSERT INTO conversations (id, employee_id, status, assigned_analyst_id, confidence,
         transfer_note, unread_count, agent_state, related_ticket_id, created_at, updated_at)
       VALUES (?, ?, 'agent', NULL, 1.0, NULL, 0, NULL, NULL, ?, ?)`,
    )
    .run(id, employeeId, now, now);
  return getConversation(id)!;
}

export function getOrCreateConversationForEmployee(
  employeeId: string,
): Conversation {
  return getActiveConversationForEmployee(employeeId) ?? createConversation(employeeId);
}

export interface ConversationPatch {
  status?: ConversationStatus;
  assignedAnalystId?: string | null;
  confidence?: number;
  transferNote?: string | null;
  unreadCount?: number;
  relatedTicketId?: string | null;
}

export function updateConversation(id: string, patch: ConversationPatch): void {
  const current = db()
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as ConversationRow | undefined;
  if (!current) return;
  db()
    .prepare(
      `UPDATE conversations SET status = @status, assigned_analyst_id = @assignedAnalystId,
         confidence = @confidence, transfer_note = @transferNote, unread_count = @unreadCount,
         related_ticket_id = @relatedTicketId, updated_at = @updatedAt WHERE id = @id`,
    )
    .run({
      id,
      status: patch.status ?? current.status,
      assignedAnalystId:
        patch.assignedAnalystId !== undefined
          ? patch.assignedAnalystId
          : current.assigned_analyst_id,
      confidence: patch.confidence ?? current.confidence,
      transferNote:
        patch.transferNote !== undefined ? patch.transferNote : current.transfer_note,
      unreadCount: patch.unreadCount ?? current.unread_count,
      relatedTicketId:
        patch.relatedTicketId !== undefined
          ? patch.relatedTicketId
          : current.related_ticket_id,
      updatedAt: nowIso(),
    });
}

// ── Estado do fluxo do agent (JSON em agent_state) ──────────────────────────

export function getAgentState<T>(conversationId: string): T | null {
  const row = db()
    .prepare("SELECT agent_state FROM conversations WHERE id = ?")
    .get(conversationId) as { agent_state: string | null } | undefined;
  if (!row || !row.agent_state) return null;
  return JSON.parse(row.agent_state) as T;
}

export function setAgentState(conversationId: string, state: unknown): void {
  db()
    .prepare(
      "UPDATE conversations SET agent_state = ?, updated_at = ? WHERE id = ?",
    )
    .run(state === null ? null : JSON.stringify(state), nowIso(), conversationId);
}

// ── Mensagens ───────────────────────────────────────────────────────────────

export function listMessages(conversationId: string): Message[] {
  const rows = db()
    .prepare(
      // rowid (ordem de inserção) desempata mensagens do mesmo milissegundo.
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY datetime(created_at) ASC, rowid ASC",
    )
    .all(conversationId) as MessageRow[];
  return rows.map(rowToMessage);
}

export interface NewMessage {
  role: MessageRole;
  authorName?: string | null;
  content: string;
  meta?: MessageMeta | null;
}

export function appendMessage(
  conversationId: string,
  msg: NewMessage,
): Message {
  const id = `msg-${randomUUID().slice(0, 10)}`;
  const createdAt = nowIso();
  db()
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, author_name, content, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      conversationId,
      msg.role,
      msg.authorName ?? null,
      msg.content,
      msg.meta ? JSON.stringify(msg.meta) : null,
      createdAt,
    );
  db()
    .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
    .run(createdAt, conversationId);
  return {
    id,
    conversationId,
    role: msg.role,
    authorName: msg.authorName ?? null,
    content: msg.content,
    meta: msg.meta ?? null,
    createdAt,
  };
}

// ── Consultas para o console do analista ────────────────────────────────────

export interface ConsoleConversation {
  conversation: Conversation;
  lastMessage: Message | null;
}

export function listConversationsForConsole(): ConsoleConversation[] {
  const rows = db()
    .prepare("SELECT * FROM conversations ORDER BY datetime(updated_at) DESC")
    .all() as ConversationRow[];
  return rows.map((r) => {
    const conv = rowToConversation(r);
    const last = db()
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY datetime(created_at) DESC, rowid DESC LIMIT 1",
      )
      .get(conv.id) as MessageRow | undefined;
    return { conversation: conv, lastMessage: last ? rowToMessage(last) : null };
  });
}
