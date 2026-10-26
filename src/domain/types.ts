/**
 * Tipos de domínio compartilhados por toda a aplicação (Anexo A).
 *
 * Estes tipos são a "linguagem ubíqua" do Nexo Assist: serviços, agent e UI
 * conversam nestes termos. Ficam separados dos serviços para evitar ciclos de
 * import e para que a camada de regras (pura) não dependa de infraestrutura.
 */

/** Tipo de chamado — incidente (algo parou) ou requisição (pedido). */
export type TicketType = "INC" | "REQ";

/** Categorias de service desk suportadas (Anexo A). */
export type TicketCategory =
  | "Acesso"
  | "Rede e VPN"
  | "Hardware"
  | "Software"
  | "E-mail"
  | "Outros";

export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  "Acesso",
  "Rede e VPN",
  "Hardware",
  "Software",
  "E-mail",
  "Outros",
] as const;

/** Prioridade (impacto + urgência). Ordenada da mais severa para a menos. */
export type Priority = "critica" | "alta" | "media" | "baixa";

export const PRIORITIES: readonly Priority[] = [
  "critica",
  "alta",
  "media",
  "baixa",
] as const;

/** Quem é afetado pelo problema. */
export type Affected = "somente_eu" | "minha_equipe" | "toda_empresa" | "nao_sei";

export const AFFECTED_OPTIONS: readonly Affected[] = [
  "somente_eu",
  "minha_equipe",
  "toda_empresa",
  "nao_sei",
] as const;

/**
 * Status de um chamado.
 * - open: aberto, ainda não triado por humano
 * - in_progress: em andamento (analista trabalhando)
 * - awaiting_analyst: aguardando um analista pegar/transferido
 * - approved: requisição aprovada (fluxo de REQ)
 * - resolved: resolvido
 */
export type TicketStatus =
  | "open"
  | "in_progress"
  | "awaiting_analyst"
  | "approved"
  | "resolved";

export interface Ticket {
  id: string; // ex: INC-20311 / REQ-10442
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  subcategory: string | null; // ex: "Notebook" em "Hardware › Notebook"
  priority: Priority;
  affected: Affected;
  status: TicketStatus;
  requesterId: string; // escopo de privacidade: dono do chamado
  assignedAnalystId: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO — "última atualização"
  dueAt: string; // ISO — prazo do SLA
  resolvedAt: string | null; // ISO
  /** Marcado como vencido por uma varredura/serviço (além de ser derivável). */
  overdue: boolean;
}

/** Tipos de evento no histórico/auditoria de um chamado. */
export type TicketEventType =
  | "created"
  | "updated"
  | "reopened"
  | "transferred"
  | "marked_overdue"
  | "resolved";

export interface TicketEvent {
  id: number;
  ticketId: string;
  type: TicketEventType;
  message: string;
  actor: string; // ex: "Nexo Assist", "Ana Souza", "Rafael Lima"
  createdAt: string;
}

export type UserRole = "employee" | "analyst";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
  analystTier: string | null; // ex: "Suporte N2"
  passwordChangedAt: string; // ISO
  avatarInitials: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  body: string;
  category: TicketCategory;
  keywords: string[];
  /** Escopo de SO quando relevante (ex: "Windows 10"). null = qualquer. */
  osScope: string | null;
}

/** Status de uma conversa no console (state machine de alto nível). */
export type ConversationStatus =
  | "agent" // agent atendendo normalmente
  | "awaiting_analyst" // transferida, aguardando analista assumir
  | "analyst" // analista assumiu (agent pausado)
  | "resolved"; // encerrada

export interface Conversation {
  id: string;
  employeeId: string;
  status: ConversationStatus;
  assignedAnalystId: string | null;
  /** Confiança do agent na última decisão (0..1), usada no console. */
  confidence: number;
  /** Rótulo de transferência mostrado no console (ex: "contato em 25 min"). */
  transferNote: string | null;
  /** Mensagens não lidas pelo analista (badge no console). */
  unreadCount: number;
  /** Chamado relacionado em foco na conversa, se houver. */
  relatedTicketId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "agent" | "analyst" | "system";

/**
 * Metadados estruturados de uma mensagem do agent, para a UI renderizar
 * elementos ricos (status line, chips, cards de chamado) de forma determinística.
 */
export interface MessageMeta {
  /** Linha de status "✓ consultou seus chamados · ✓ buscou na central". */
  statusLine?: string[];
  /** Chips clicáveis exibidos abaixo da bolha. */
  chips?: ChatChip[];
  /** Card de rascunho de novo chamado aguardando confirmação. */
  draft?: TicketDraft;
  /** Card de um chamado existente. */
  ticketCard?: TicketCardData;
  /** Seletor de chamados (lista com radio). */
  ticketPicker?: TicketPickerItem[];
}

export interface ChatChip {
  id: string;
  label: string;
  /** Ação semântica para o backend quando o chip é clicado. */
  action: string;
  selected?: boolean;
}

export interface TicketDraft {
  draftId: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  subcategory: string | null;
  priority: Priority;
  affected: Affected;
  dueAt: string; // ISO — prazo calculado
  /** Quando preenchido, confirmar atualiza este chamado em vez de criar novo. */
  updatesTicketId?: string;
}

export interface TicketCardData {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  subcategory: string | null;
  priority: Priority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  overdue: boolean;
}

export interface TicketPickerItem {
  id: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  authorName: string | null; // ex: "Nexo Assist", "Rafael Lima · Suporte N2"
  content: string;
  meta: MessageMeta | null;
  createdAt: string;
}
