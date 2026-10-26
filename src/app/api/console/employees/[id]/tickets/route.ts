import { NextResponse } from "next/server";
import { getAuthContext, getCurrentUser } from "@/lib/auth";
import {
  listTicketsByEmployee,
  withRetry,
  isTransient,
} from "@/services/ticket-service";
import { getUser } from "@/services/directory";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const analyst = await getCurrentUser();
  const ctx = await getAuthContext();
  if (!analyst || analyst.role !== "analyst" || !ctx) {
    return NextResponse.json({ error: "Acesso restrito a analistas." }, { status: 403 });
  }
  const { id } = await params;
  const employee = getUser(id);
  if (!employee) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });

  try {
    const tickets = await withRetry(() => listTicketsByEmployee(ctx, id));
    return NextResponse.json({ employee, tickets });
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
