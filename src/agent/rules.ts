/**
 * Regras de decisão do service desk (Anexo A), como funções PURAS e sem
 * dependências de infraestrutura. É aqui que mora o "julgamento" do agent:
 * prioridade, SLA/prazo, vencimento, duplicidade/reabertura, transferência e
 * escopo. Ficam isoladas justamente para serem determinísticas e testáveis —
 * o LLM só é responsável pela linguagem natural, não por estas decisões.
 */

import type {
  Affected,
  Priority,
  TicketCategory,
  TicketType,
} from "@/domain/types";

// ─────────────────────────────────────────────────────────────────────────
// Horário comercial e SLA
// ─────────────────────────────────────────────────────────────────────────

/** Service desk: 8h–18h, segunda a sexta (Anexo A). */
export const BUSINESS = {
  startHour: 8,
  endHour: 18,
  /** 0 = domingo ... 6 = sábado. */
  workDays: [1, 2, 3, 4, 5] as const,
} as const;

function isWorkDay(d: Date): boolean {
  return (BUSINESS.workDays as readonly number[]).includes(d.getDay());
}

/** Verdadeiro se `d` cai dentro do expediente (dia útil e dentro do horário). */
export function isBusinessMoment(d: Date): boolean {
  if (!isWorkDay(d)) return false;
  const h = d.getHours();
  return h >= BUSINESS.startHour && h < BUSINESS.endHour;
}

/** Avança `d` para o próximo início de expediente (08:00 de um dia útil). */
function nextBusinessStart(d: Date): Date {
  const out = new Date(d);
  // Se ainda é cedo num dia útil, o próximo início é hoje às 08:00.
  if (isWorkDay(out) && out.getHours() < BUSINESS.startHour) {
    out.setHours(BUSINESS.startHour, 0, 0, 0);
    return out;
  }
  // Caso contrário, pula para o próximo dia e procura um dia útil.
  do {
    out.setDate(out.getDate() + 1);
    out.setHours(BUSINESS.startHour, 0, 0, 0);
  } while (!isWorkDay(out));
  return out;
}

/** Soma `minutes` minutos ÚTEIS a partir de `from`. */
export function addBusinessMinutes(from: Date, minutes: number): Date {
  let d = new Date(from);
  let remaining = Math.max(0, Math.round(minutes));
  while (remaining > 0) {
    if (!isBusinessMoment(d)) {
      d = nextBusinessStart(d);
      continue;
    }
    d = new Date(d.getTime() + 60_000);
    remaining -= 1;
  }
  return d;
}

/** Soma `hours` horas ÚTEIS. */
export function addBusinessHours(from: Date, hours: number): Date {
  return addBusinessMinutes(from, hours * 60);
}

/** Soma `days` dias ÚTEIS (preserva o horário, pulando fins de semana). */
export function addBusinessDays(from: Date, days: number): Date {
  const out = new Date(from);
  let remaining = Math.max(0, Math.round(days));
  while (remaining > 0) {
    out.setDate(out.getDate() + 1);
    if (isWorkDay(out)) remaining -= 1;
  }
  return out;
}

export interface SlaSpec {
  priority: Priority;
  /** Rótulo humano do prazo (ex: "4h úteis"). */
  label: string;
  /** Rótulo da política de resposta (ex: "resposta em até 4h úteis"). */
  responseLabel: string;
}

export const SLA_BY_PRIORITY: Record<Priority, SlaSpec> = {
  critica: {
    priority: "critica",
    label: "1 hora",
    responseLabel: "resposta em até 1 hora (plantão 24h)",
  },
  alta: {
    priority: "alta",
    label: "4h úteis",
    responseLabel: "resposta em até 4h úteis",
  },
  media: {
    priority: "media",
    label: "3 dias úteis",
    responseLabel: "resposta em até 3 dias úteis",
  },
  baixa: {
    priority: "baixa",
    label: "5 dias úteis",
    responseLabel: "resposta em até 5 dias úteis",
  },
};

/**
 * Calcula o prazo (dueAt) de um chamado a partir da abertura e da prioridade.
 * Crítica usa relógio corrido (plantão 24h); as demais usam tempo útil.
 */
export function computeDueAt(from: Date, priority: Priority): Date {
  switch (priority) {
    case "critica":
      return new Date(from.getTime() + 60 * 60_000); // 1h corrida
    case "alta":
      return addBusinessHours(from, 4);
    case "media":
      return addBusinessDays(from, 3);
    case "baixa":
      return addBusinessDays(from, 5);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Classificação de prioridade (impacto + urgência)
// ─────────────────────────────────────────────────────────────────────────

export interface PriorityInput {
  type: TicketType;
  affected: Affected;
  /** Algo parou / impede de trabalhar (incidente bloqueante). */
  workBlocked: boolean;
  /** Há compromisso/entrega no mesmo dia. */
  sameDayCommitment: boolean;
}

/**
 * Deriva a prioridade conforme o Anexo A:
 *  - Crítica: algo parado para uma equipe/empresa inteira
 *  - Alta: impede uma pessoa de trabalhar OU compromisso no mesmo dia
 *  - Média: atrapalha mas há alternativa (incidente)
 *  - Baixa: pedidos/melhorias sem urgência
 */
export function classifyPriority(input: PriorityInput): Priority {
  const widespread =
    input.affected === "minha_equipe" || input.affected === "toda_empresa";

  if (input.type === "INC" && input.workBlocked && widespread) {
    return "critica";
  }
  if ((input.workBlocked && input.affected === "somente_eu") || input.sameDayCommitment) {
    return "alta";
  }
  if (input.type === "INC") {
    return "media";
  }
  return "baixa";
}

// ─────────────────────────────────────────────────────────────────────────
// Vencimento
// ─────────────────────────────────────────────────────────────────────────

export interface OverdueCheckTicket {
  status: string;
  dueAt: string | Date;
}

/** Um chamado está vencido se não foi resolvido e passou do prazo. */
export function isOverdue(ticket: OverdueCheckTicket, now: Date = new Date()): boolean {
  if (ticket.status === "resolved") return false;
  const due = ticket.dueAt instanceof Date ? ticket.dueAt : new Date(ticket.dueAt);
  return now.getTime() > due.getTime();
}

// ─────────────────────────────────────────────────────────────────────────
// Duplicidade e reabertura
// ─────────────────────────────────────────────────────────────────────────

/** Dias dentro dos quais um chamado resolvido pode ser reaberto (Anexo A). */
export const REOPEN_WINDOW_DAYS = 7;

export type DedupeAction = "update" | "reopen" | "create";

export interface DedupeCandidate {
  category: TicketCategory;
  /** Texto do novo problema (título + descrição ou mensagem do usuário). */
  text: string;
}

export interface DedupeExistingTicket {
  id: string;
  category: TicketCategory;
  status: string;
  /** Texto do chamado existente (título + descrição). */
  text: string;
  resolvedAt: string | Date | null;
}

export interface DedupeResult {
  action: DedupeAction;
  ticketId?: string;
  reason: string;
}

const STOPWORDS = new Set([
  "para","com","sem","não","nao","uma","que","dos","das","por","nos","nas",
  "meu","minha","está","esta","estao","estão","esta","the","and","mais","aqui",
  "tem","foi","era","mas","sim","ate","até","desde","depois","antes","hoje",
]);

/** Normaliza texto para comparação: minúsculas, sem acentos e pontuação. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrai tokens significativos (>= 4 chars, sem stopwords). */
export function significantTokens(text: string): Set<string> {
  const tokens = normalize(text)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function sharesKeyword(a: string, b: string): boolean {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  for (const t of ta) {
    if (tb.has(t)) return true;
  }
  return false;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * Decide se um novo problema deve ATUALIZAR um chamado aberto equivalente,
 * REABRIR um resolvido recentemente, ou CRIAR um novo — evitando duplicidade.
 */
export function detectDuplicate(
  candidate: DedupeCandidate,
  existing: DedupeExistingTicket[],
  now: Date = new Date(),
): DedupeResult {
  const sameCategory = existing.filter((t) => t.category === candidate.category);

  // 1) Chamado aberto equivalente → atualizar em vez de duplicar.
  const open = sameCategory.find(
    (t) => t.status !== "resolved" && sharesKeyword(candidate.text, t.text),
  );
  if (open) {
    return {
      action: "update",
      ticketId: open.id,
      reason: "Já existe um chamado aberto sobre o mesmo assunto.",
    };
  }

  // 2) Resolvido há <= 7 dias e equivalente → reabrir.
  const reopenable = sameCategory
    .filter(
      (t) =>
        t.status === "resolved" &&
        t.resolvedAt != null &&
        sharesKeyword(candidate.text, t.text),
    )
    .filter((t) => {
      const resolved =
        t.resolvedAt instanceof Date ? t.resolvedAt : new Date(t.resolvedAt as string);
      return daysBetween(now, resolved) <= REOPEN_WINDOW_DAYS;
    });
  if (reopenable.length > 0) {
    // mais recente primeiro
    reopenable.sort((a, b) => {
      const da = new Date(a.resolvedAt as string | Date).getTime();
      const db = new Date(b.resolvedAt as string | Date).getTime();
      return db - da;
    });
    const first = reopenable[0]!;
    return {
      action: "reopen",
      ticketId: first.id,
      reason: `Havia um chamado resolvido há pouco (até ${REOPEN_WINDOW_DAYS} dias) sobre o mesmo assunto.`,
    };
  }

  return { action: "create", reason: "Nenhum chamado equivalente encontrado." };
}

// ─────────────────────────────────────────────────────────────────────────
// Transferência para analista
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

export type TransferReason =
  | "user_request"
  | "critical"
  | "overdue"
  | "low_confidence";

export interface TransferInput {
  /** O funcionário pediu explicitamente um analista. */
  userRequested: boolean;
  /** Prioridade do caso/chamado em questão. */
  priority?: Priority;
  /** O chamado em foco está vencido. */
  ticketOverdue: boolean;
  /** Confiança do agent na decisão (0..1). */
  agentConfidence: number;
  confidenceThreshold?: number;
}

export interface TransferDecision {
  transfer: boolean;
  reason: TransferReason | null;
  /** Mensagem curta para o resumo levado ao analista. */
  summary: string;
}

/**
 * Decide se a conversa deve ir para um analista humano. Transfere quando o
 * funcionário pede, em casos críticos, em chamados vencidos, ou quando o agent
 * não tem segurança (confiança abaixo do limiar).
 */
export function shouldTransfer(input: TransferInput): TransferDecision {
  const threshold = input.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  if (input.userRequested) {
    return {
      transfer: true,
      reason: "user_request",
      summary: "O funcionário pediu para falar com um analista.",
    };
  }
  if (input.priority === "critica") {
    return {
      transfer: true,
      reason: "critical",
      summary: "Caso crítico — encaminhado imediatamente ao plantão.",
    };
  }
  if (input.ticketOverdue) {
    return {
      transfer: true,
      reason: "overdue",
      summary: "Chamado vencido — encaminhado para um analista priorizar.",
    };
  }
  if (input.agentConfidence < threshold) {
    return {
      transfer: true,
      reason: "low_confidence",
      summary: `O agent não teve segurança para resolver sozinho (confiança ${(input.agentConfidence * 100).toFixed(0)}%).`,
    };
  }
  return { transfer: false, reason: null, summary: "" };
}

// ─────────────────────────────────────────────────────────────────────────
// Escopo (só assuntos de TI)
// ─────────────────────────────────────────────────────────────────────────

export type OutOfScopeArea = "rh" | "financeiro" | "facilities";

const SCOPE_SIGNALS: Record<OutOfScopeArea, string[]> = {
  rh: ["férias", "ferias", "folha", "holerite", "contracheque", "salário", "salario", "benefício", "beneficio", "vale refeição", "vale-refeicao", "recursos humanos", "atestado", "demissão", "demissao", "admissão", "admissao"],
  financeiro: ["reembolso", "nota fiscal", "pagamento de fornecedor", "adiantamento", "despesa", "financeiro contas", "contas a pagar", "orçamento", "orcamento"],
  facilities: ["ar-condicionado", "ar condicionado", "limpeza", "cadeira quebrada", "lâmpada", "lampada", "copa", "estacionamento", "crachá de acesso físico", "manutenção predial", "manutencao predial"],
};

export interface ScopeResult {
  inScope: boolean;
  area: OutOfScopeArea | null;
}

/**
 * Classifica se o pedido é de TI. Palavras de RH/financeiro/facilities marcam
 * o assunto como fora de escopo (o agent redireciona educadamente).
 */
export function classifyScope(text: string): ScopeResult {
  const norm = normalize(text);
  for (const area of Object.keys(SCOPE_SIGNALS) as OutOfScopeArea[]) {
    for (const signal of SCOPE_SIGNALS[area]) {
      if (norm.includes(normalize(signal))) {
        return { inScope: false, area };
      }
    }
  }
  return { inScope: true, area: null };
}
