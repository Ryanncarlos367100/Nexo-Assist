/**
 * Helpers de apresentação para o console do analista: deriva a "tag" de status
 * de cada conversa (ex.: "Transferida", "Agent pediu ajuda · confiança 41%")
 * a partir do estado da conversa, para a UI não duplicar essa lógica.
 */

import type { Conversation, Message, User } from "@/domain/types";

export type ConsoleTagKind =
  | "transfer"
  | "help"
  | "agent"
  | "active"
  | "resolved";

export interface ConsoleTag {
  label: string;
  kind: ConsoleTagKind;
}

export function deriveTag(
  conv: Conversation,
  currentAnalystId: string | null,
): ConsoleTag {
  switch (conv.status) {
    case "awaiting_analyst": {
      const suffix = conv.transferNote
        ? ` · ${conv.transferNote}`
        : conv.relatedTicketId
          ? ` · ${conv.relatedTicketId}`
          : "";
      return { label: `Transferida${suffix}`, kind: "transfer" };
    }
    case "analyst":
      return {
        label:
          conv.assignedAnalystId && conv.assignedAnalystId === currentAnalystId
            ? "Você está atendendo"
            : "Em atendimento",
        kind: "active",
      };
    case "resolved":
      return { label: "Resolvida pelo agent", kind: "resolved" };
    case "agent":
    default:
      if (conv.confidence < 0.5) {
        return {
          label: `Agent pediu ajuda · confiança ${Math.round(conv.confidence * 100)}%`,
          kind: "help",
        };
      }
      return { label: "Agent atendendo", kind: "agent" };
  }
}

export interface ConsoleListItem {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    initials: string;
    department: string | null;
  };
  status: Conversation["status"];
  confidence: number;
  unreadCount: number;
  relatedTicketId: string | null;
  assignedAnalystId: string | null;
  lastMessage: { role: Message["role"]; content: string; createdAt: string } | null;
  updatedAt: string;
  tag: ConsoleTag;
}

export function toConsoleListItem(
  conv: Conversation,
  employee: User,
  lastMessage: Message | null,
  currentAnalystId: string | null,
): ConsoleListItem {
  return {
    id: conv.id,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      initials: employee.avatarInitials,
      department: employee.department,
    },
    status: conv.status,
    confidence: conv.confidence,
    unreadCount: conv.unreadCount,
    relatedTicketId: conv.relatedTicketId,
    assignedAnalystId: conv.assignedAnalystId,
    lastMessage: lastMessage
      ? {
          role: lastMessage.role,
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
        }
      : null,
    updatedAt: conv.updatedAt,
    tag: deriveTag(conv, currentAnalystId),
  };
}
