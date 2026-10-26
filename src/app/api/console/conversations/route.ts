import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listConversationsForConsole } from "@/services/conversation-service";
import { getUser } from "@/services/directory";
import { toConsoleListItem } from "@/lib/console";

export async function GET(): Promise<NextResponse> {
  const analyst = await getCurrentUser();
  if (!analyst || analyst.role !== "analyst") {
    return NextResponse.json({ error: "Acesso restrito a analistas." }, { status: 403 });
  }

  const items = listConversationsForConsole().flatMap(({ conversation, lastMessage }) => {
    const employee = getUser(conversation.employeeId);
    if (!employee) return [];
    return [toConsoleListItem(conversation, employee, lastMessage, analyst.id)];
  });

  return NextResponse.json({ conversations: items, analyst });
}
