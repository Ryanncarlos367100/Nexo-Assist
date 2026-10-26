/**
 * Montagem do Nexo Assist como Mastra Agent.
 *
 * Usado no fluxo de PERGUNTAS LIVRES (dúvidas de TI em linguagem natural): o
 * agent pode chamar as tools (central de ajuda / chamados do usuário) e compor
 * a resposta. Os fluxos ESTRUTURADOS (rascunho/confirmação de chamado, status,
 * transferência) são conduzidos deterministicamente pelo engine, que usa estas
 * mesmas regras — o LLM só cuida da linguagem.
 */

import { Agent } from "@mastra/core/agent";
import { SYSTEM_PROMPT } from "./prompt";
import { buildTools } from "./tools";
import { getModel } from "./llm";
import type { AuthContext } from "@/services/ticket-service";
import type { Message } from "@/domain/types";

export interface AgentTurn {
  role: "user" | "assistant";
  content: string;
}

/** Converte o histórico persistido em mensagens para o LLM. */
export function toAgentTurns(history: Message[]): AgentTurn[] {
  return history
    .filter((m) => m.role === "user" || m.role === "agent")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));
}

/**
 * Responde uma pergunta livre de TI usando o Mastra Agent (com tools). Retorna
 * null quando não há LLM configurado — nesse caso o engine usa o fallback
 * determinístico baseado na central de ajuda.
 */
export async function answerFreeform(
  authCtx: AuthContext,
  history: Message[],
  userText: string,
): Promise<string | null> {
  const model = await getModel();
  if (!model) return null;

  const agent = new Agent({
    name: "Nexo Assist",
    instructions: SYSTEM_PROMPT,
    model,
    tools: buildTools(authCtx),
  });

  const messages = [
    ...toAgentTurns(history),
    { role: "user" as const, content: userText },
  ];

  const result = await agent.generate(messages, { maxSteps: 4 });
  return result.text.trim();
}

/**
 * Reescreve um texto-base (decisão já tomada pelas regras) em linguagem natural,
 * preservando fielmente fatos como id de chamado, prioridade e prazo. Retorna o
 * próprio texto-base quando não há LLM configurado.
 */
export async function phrase(
  authCtx: AuthContext,
  baseline: string,
  context: string,
): Promise<string> {
  const model = await getModel();
  if (!model) return baseline;

  try {
    const agent = new Agent({
      name: "Nexo Assist",
      instructions: SYSTEM_PROMPT,
      model,
    });
    const result = await agent.generate(
      [
        {
          role: "user",
          content: `Reescreva a mensagem a seguir para o funcionário, de forma natural e cordial, SEM alterar nenhum fato (ids de chamado, prioridade, prazos, horários). Responda apenas com a mensagem final, sem aspas.\n\nContexto: ${context}\n\nMensagem: "${baseline}"`,
        },
      ],
      { maxSteps: 1 },
    );
    const text = result.text.trim();
    return text.length > 0 ? text : baseline;
  } catch {
    // Qualquer falha de LLM cai para o texto determinístico.
    return baseline;
  }
}
