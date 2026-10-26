import { NextResponse } from "next/server";
import { verifyCredentials } from "@/services/directory";
import { createSession } from "@/lib/auth";

export async function POST(req: Request): Promise<NextResponse> {
  let body: { email?: string; password?: string; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Informe e-mail e senha." },
      { status: 400 },
    );
  }

  const user = verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  await createSession(user.id, body.remember === true);
  return NextResponse.json({ user });
}
