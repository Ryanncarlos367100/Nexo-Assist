import { NextResponse } from "next/server";
import { getCurrentUser, getAuthContext } from "@/lib/auth";
import {
  getConversation,
  getOrCreateConversationForEmployee,
  listMessages,
} from "@/services/conversation-service";
import { handleChat, type ChatInput } from "@/agent/engine";
import { getLlmInfo } from "@/agent/llm";

function payload(conversationId: string) {
  const conversation = getConversation(conversationId);
  return {
    conversation,
    messages: listMessages(conversationId),
    llm: getLlmInfo(),
  };
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const conv = getOrCreateConversationForEmployee(user.id);
  return NextResponse.json(payload(conv.id));
}

export async function POST(req: Request): Promise<NextResponse> {
  const ctx = await getAuthContext();
  const user = await getCurrentUser();
  if (!ctx || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { text?: string; action?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const conv = getOrCreateConversationForEmployee(user.id);

  let input: ChatInput | null = null;
  if (typeof body.action === "string" && body.action.length > 0) {
    input = { kind: "action", action: body.action, value: body.value };
  } else if (typeof body.text === "string" && body.text.trim().length > 0) {
    input = { kind: "text", text: body.text };
  }
  if (!input) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  const result = await handleChat(ctx, conv.id, input);
  return NextResponse.json({ ...payload(conv.id), paused: result.paused });
}
