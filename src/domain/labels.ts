/**
 * Rótulos humanos (pt-BR) e formatação para prioridade, categoria, status e
 * datas. Compartilhado entre o engine do agent e a UI para evitar divergência.
 */

import type {
  Affected,
  Priority,
  TicketStatus,
  TicketType,
} from "./types";

export const PRIORITY_LABEL: Record<Priority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

/** Classe de badge da UI por prioridade. */
export const PRIORITY_BADGE: Record<Priority, string> = {
  critica: "badge-danger",
  alta: "badge-warning",
  media: "badge-progress",
  baixa: "badge-neutral",
};

export const AFFECTED_LABEL: Record<Affected, string> = {
  somente_eu: "Somente você",
  minha_equipe: "Minha equipe",
  toda_empresa: "Toda a empresa",
  nao_sei: "Não sei",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  awaiting_analyst: "Aguardando analista",
  approved: "Aprovado",
  resolved: "Resolvido",
};

export const STATUS_BADGE: Record<TicketStatus, string> = {
  open: "badge-neutral",
  in_progress: "badge-progress",
  awaiting_analyst: "badge-warning",
  approved: "badge-success",
  resolved: "badge-success",
};

export const TYPE_LABEL: Record<TicketType, string> = {
  INC: "Incidente",
  REQ: "Requisição",
};

const MONTHS = [
  "jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez",
];

/** "16 out, 14:20" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const mon = MONTHS[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon}, ${hh}:${mm}`;
}

/** "16 out" */
export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "13:43" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** "há 5 dias" / "há 3 horas" / "agora". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}
