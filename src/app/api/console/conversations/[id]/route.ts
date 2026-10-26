import { NextResponse } from "next/server";
import { getCurrentUser, getAuthContext } from "@/lib/auth";
import {
  getConversation,
  listMessages,
  appendMessage,
  updateConversation,
} from "@/services/conversation-service";
import { getUser } from "@/services/directory";
import { updateTicket, withRetry } from "@/services/ticket-service";
import { deriveTag } from "@/lib/console";

function detailPayload(conversationId: string, analystId: string) {
  const conversation = getConversation(conversationId);
  if (!conversation) return null;
  const employee = getUser(conversation.employeeId);
  const analyst = conversation.assignedAnalystId
    ? getUser(conversation.assignedAnalystId)
    : null;
  return {
    conversation,
    employee,
    assignedAnalyst: analyst,
    messages: listMessages(conversationId),
    tag: deriveTag(conversation, analystId),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const analyst = await getCurrentUser();
  if (!analyst || analyst.role !== "analyst") {
    return NextResponse.json({ error: "Acesso restrito a analistas." }, { status: 403 });
  }
  const { id } = await params;
  const payload = detailPayload(id, analyst.id);
  if (!payload) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json(payload);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const analyst = await getCurrentUser();
  const ctx = await getAuthContext();
  if (!analyst || analyst.role !== "analyst" || !ctx) {
    return NextResponse.json({ error: "Acesso restrito a analistas." }, { status: 403 });
  }
  const { id } = await params;
  const conv = getConversation(id);
  if (!conv) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });

  let body: { op?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const tierLabel = analyst.analystTier ?? "Suporte N2";

  switch (body.op) {
    case "assume": {
      updateConversation(id, {
        status: "analyst",
        assignedAnalystId: analyst.id,
        unreadCount: 0,
      });
      appendMessage(id, {
        role: "system",
        content: `${analyst.name} assumiu · agent pausado`,
      });
      // Reflete no chamado em foco (vai para "Em andamento" + atribuição).
      if (conv.relatedTicketId) {
        try {
          await withRetry(() =>
            updateTicket(
              ctx,
              conv.relatedTicketId!,
              { status: "in_progress", assignedAnalystId: analyst.id },
              analyst.name,
              `Assumido por ${analyst.name}.`,
            ),
          );
        } catch {
          /* não bloqueia o takeover se o serviço oscilar */
        }
      }
      break;
    }
    case "release": {
      updateConversation(id, { status: "agent", assignedAnalystId: null });
      appendMessage(id, {
        role: "system",
        content: `Devolvida ao agent por ${analyst.name}`,
      });
      break;
    }
    case "close": {
      updateConversation(id, { status: "resolved" });
      appendMessage(id, {
        role: "system",
        content: `Atendimento encerrado por ${analyst.name}`,
      });
      break;
    }
    case "message": {
      const text = (body.text ?? "").trim();
      if (!text) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
      if (conv.status !== "analyst" || conv.assignedAnalystId !== analyst.id) {
        return NextResponse.json(
          { error: "Assuma o atendimento para responder." },
          { status: 409 },
        );
      }
      appendMessage(id, {
        role: "analyst",
        authorName: `${analyst.name} · ${tierLabel}`,
        content: text,
      });
      break;
    }
    default:
      return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
  }

  const payload = detailPayload(id, analyst.id);
  return NextResponse.json(payload);
}
