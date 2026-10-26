import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { listTickets, withRetry, isTransient } from "@/services/ticket-service";

export async function GET(): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const tickets = await withRetry(() => listTickets(ctx));
    return NextResponse.json({ tickets });
  } catch (err) {
    if (isTransient(err)) {
      return NextResponse.json(
        { error: "Serviço de chamados indisponível. Tente novamente." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Erro ao listar chamados." }, { status: 500 });
  }
}
