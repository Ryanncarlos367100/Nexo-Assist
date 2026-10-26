/**
 * Engine do Nexo Assist — orquestrador determinístico da conversa.
 *
 * Responsabilidades:
 *  - State machine do atendimento (coletar "afetados" → rascunho → confirmação;
 *    consulta de status; transferência; pausa quando há analista).
 *  - Aplica as REGRAS (rules.ts) para decidir prioridade, duplicidade,
 *    vencimento e transferência — de forma determinística e testável.
 *  - Produz mensagens com meta estruturada (status line, chips, cards) para a UI.
 *  - Delega a LINGUAGEM NATURAL ao LLM (Mastra) quando configurado; caso
 *    contrário, usa texto determinístico. As decisões nunca dependem do LLM.
 *
 * O frontend fala com este engine apenas via rotas de API.
 */

import type {
  Affected,
  ChatChip,
  Message,
  TicketCardData,
  TicketDraft,
  TicketPickerItem,
  Ticket,
  TicketCategory,
  TicketType,
} from "@/domain/types";
import {
  classifyPriority,
  computeDueAt,
  detectDuplicate,
  isOverdue,
  shouldTransfer,
  classifyScope,
  type DedupeAction,
} from "./rules";
import {
  detectIntent,
  detectAffected,
  detectUrgency,
  classifyProblem,
} from "./nlu";
import { answerFreeform } from "./nexoAgent";
import {
  AFFECTED_LABEL,
  PRIORITY_LABEL,
  formatTime,
} from "@/domain/labels";
import {
  appendMessage,
  getAgentState,
  setAgentState,
  getConversation,
  updateConversation,
  listMessages,
} from "@/services/conversation-service";
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  reopenTicket,
  transferTicket,
  withRetry,
  isTransient,
  type AuthContext,
} from "@/services/ticket-service";
import { searchArticles } from "@/services/help-center";
import { getUser } from "@/services/directory";

// ── Estado do fluxo ─────────────────────────────────────────────────────────

interface PendingProblem {
  text: string;
  type: TicketType;
  category: TicketCategory;
  subcategory: string | null;
  title: string;
  description: string;
  affected: Affected | null;
  workBlocked: boolean;
  sameDayCommitment: boolean;
  dedupeAction: DedupeAction;
  targetTicketId?: string;
  caveat?: string;
}

type AgentState =
  | { kind: "idle" }
  | { kind: "awaiting_affected"; problem: PendingProblem }
  | {
      kind: "awaiting_confirmation";
      problem: PendingProblem;
      draft: TicketDraft;
    }
  | { kind: "offered_article"; problem: PendingProblem }
  | { kind: "awaiting_status_selection" };

// ── Entrada do handler ──────────────────────────────────────────────────────

export type ChatInput =
  | { kind: "text"; text: string }
  | { kind: "action"; action: string; value?: string };

export interface ChatResult {
  /** true quando a conversa está com analista (agent pausado). */
  paused: boolean;
}

// ── Helpers de card/draft ───────────────────────────────────────────────────

function ticketToCard(t: Ticket): TicketCardData {
  return {
    id: t.id,
    type: t.type,
    title: t.title,
    description: t.description,
    category: t.category,
    subcategory: t.subcategory,
    priority: t.priority,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    dueAt: t.dueAt,
    overdue: t.overdue || isOverdue(t),
  };
}

let draftCounter = 100;
function nextDraftId(): string {
  draftCounter += 1;
  return `D-${draftCounter}`;
}

// ── Entrada principal ───────────────────────────────────────────────────────

export async function handleChat(
  authCtx: AuthContext,
  conversationId: string,
  input: ChatInput,
): Promise<ChatResult> {
  const conv = getConversation(conversationId);
  if (!conv) throw new Error(`Conversa ${conversationId} não encontrada.`);

  const user = getUser(authCtx.userId);
  const userName = user?.name ?? "Funcionário";

  // Registra a mensagem/ação do funcionário como bolha.
  const userBubble = inputToUserBubble(input);
  if (userBubble) {
    appendMessage(conversationId, {
      role: "user",
      authorName: userName,
      content: userBubble,
    });
  }

  // Agent pausado enquanto a conversa está com (ou aguardando) um analista.
  if (conv.status === "analyst" || conv.status === "awaiting_analyst") {
    updateConversation(conversationId, {
      unreadCount: conv.unreadCount + 1,
    });
    return { paused: true };
  }

  const state = getAgentState<AgentState>(conversationId) ?? { kind: "idle" };

  try {
    if (input.kind === "action") {
      await handleAction(authCtx, conversationId, state, input);
    } else {
      await handleText(authCtx, conversationId, state, input.text);
    }
  } catch (err) {
    // Tratamento explícito: erro transitório do serviço vira mensagem amigável.
    const msg = isTransient(err)
      ? "Tive um problema para falar com o sistema de chamados agora. Pode tentar de novo em instantes?"
      : "Desculpe, algo deu errado por aqui. Pode reformular ou tentar novamente?";
    appendMessage(conversationId, {
      role: "agent",
      authorName: "Nexo Assist",
      content: msg,
    });
  }

  return { paused: false };
}

function inputToUserBubble(input: ChatInput): string | null {
  if (input.kind === "text") return input.text.trim() || null;
  // Ações que representam escolha do usuário viram bolha; as "internas" não.
  if (input.action.startsWith("affected:")) {
    const v = input.action.split(":")[1] as Affected;
    return AFFECTED_LABEL[v] ?? null;
  }
  if (input.action.startsWith("select_ticket:")) {
    return input.value ?? null;
  }
  const labels: Record<string, string> = {
    transfer: "Quero falar com um analista.",
    confirm: "Confirmar",
    cancel: "Cancelar",
    decline: "Não, obrigado",
    add_info: "Adicionar informação",
    open_ticket: "Abrir um chamado",
    resolved_ok: "Isso resolveu, obrigado!",
  };
  return labels[input.action] ?? null;
}

// ── Ações (chips/botões) ────────────────────────────────────────────────────

async function handleAction(
  authCtx: AuthContext,
  convId: string,
  state: AgentState,
  input: { kind: "action"; action: string; value?: string },
): Promise<void> {
  const { action } = input;

  if (action.startsWith("affected:")) {
    const affected = action.split(":")[1] as Affected;
    if (state.kind === "awaiting_affected") {
      state.problem.affected = affected;
      await buildDraftAndAsk(authCtx, convId, state.problem);
    }
    return;
  }

  if (action.startsWith("select_ticket:")) {
    const id = action.split(":")[1]!;
    await showTicketStatus(authCtx, convId, id);
    return;
  }

  switch (action) {
    case "confirm":
      if (state.kind === "awaiting_confirmation") {
        await confirmDraft(authCtx, convId, state.problem, state.draft);
      } else {
        agentSay(convId, "Não há nenhum rascunho para confirmar agora.");
      }
      return;
    case "cancel":
      setAgentState(convId, { kind: "idle" });
      agentSay(convId, "Tudo bem, não criei nada. Qualquer coisa é só me chamar.");
      return;
    case "edit":
      if (state.kind === "awaiting_confirmation") {
        agentSay(
          convId,
          "Claro — me diga o que ajustar (título, descrição, prioridade ou afetados) que eu refaço o rascunho.",
        );
      }
      return;
    case "transfer":
      await transferToAnalyst(authCtx, convId, "O funcionário pediu para falar com um analista.");
      return;
    case "add_info":
      setAgentState(convId, { kind: "idle" });
      agentSay(convId, "Pode me contar o que mudou ou o que falta? Vou anexar ao chamado.");
      return;
    case "decline":
      setAgentState(convId, { kind: "idle" });
      agentSay(convId, "Certo! Fico à disposição se precisar de mais alguma coisa.");
      return;
    case "resolved_ok":
      setAgentState(convId, { kind: "idle" });
      updateConversation(convId, { status: "resolved" });
      agentSay(convId, "Que bom que resolveu! 😊 Se precisar, é só abrir o chat de novo.");
      return;
    case "open_ticket":
      if (state.kind === "offered_article") {
        await buildDraftAndAsk(authCtx, convId, state.problem);
      } else {
        agentSay(convId, "Pode descrever o problema que eu abro um chamado para você.");
      }
      return;
    default:
      agentSay(convId, "Não entendi a ação. Pode tentar de novo?");
  }
}

// ── Texto livre ─────────────────────────────────────────────────────────────

async function handleText(
  authCtx: AuthContext,
  convId: string,
  state: AgentState,
  text: string,
): Promise<void> {
  // Continuação de fluxos que esperam uma resposta específica.
  if (state.kind === "awaiting_affected") {
    const affected = detectAffected(text) ?? state.problem.affected;
    // Captura urgência extra informada junto ("tenho reunião às 14h").
    const urgency = detectUrgency(text);
    state.problem.workBlocked = state.problem.workBlocked || urgency.workBlocked;
    state.problem.sameDayCommitment =
      state.problem.sameDayCommitment || urgency.sameDayCommitment;
    if (affected) {
      state.problem.affected = affected;
      await buildDraftAndAsk(authCtx, convId, state.problem);
    } else {
      agentSay(
        convId,
        "Só para eu classificar certo: isso afeta somente você, sua equipe ou a empresa toda?",
      );
    }
    return;
  }

  if (state.kind === "awaiting_confirmation") {
    const intent = detectIntent(text);
    if (intent === "confirm") {
      await confirmDraft(authCtx, convId, state.problem, state.draft);
    } else if (intent === "cancel") {
      setAgentState(convId, { kind: "idle" });
      agentSay(convId, "Tudo bem, cancelei o rascunho.");
    } else {
      agentSay(
        convId,
        "Quer que eu crie o chamado como está? Use os botões abaixo do rascunho (Confirmar / Editar / Cancelar).",
      );
    }
    return;
  }

  // Roteamento por intenção.
  const intent = detectIntent(text);

  if (intent === "transfer") {
    await transferToAnalyst(authCtx, convId, "O funcionário pediu para falar com um analista.");
    return;
  }
  if (intent === "greeting") {
    agentSay(
      convId,
      "Oi! Sou o Nexo Assist, o assistente de TI da Nexo. Me conta o que está acontecendo que eu te ajudo.",
    );
    return;
  }
  if (intent === "status") {
    await handleStatusQuery(authCtx, convId);
    return;
  }

  // Fora de escopo (RH/financeiro/facilities)?
  const scope = classifyScope(text);
  if (!scope.inScope) {
    const area =
      scope.area === "rh"
        ? "o RH"
        : scope.area === "financeiro"
          ? "o Financeiro"
          : "Facilities";
    agentSay(
      convId,
      `Esse assunto é com ${area}, não com a TI. Por aqui eu cuido só de temas de tecnologia (acesso, rede, hardware, software e e-mail). Posso ajudar em algo de TI?`,
    );
    return;
  }

  // Problema de TI → ajuda/dedup/abertura.
  await handleNewProblem(authCtx, convId, text);
}

// ── Novo problema: central de ajuda + duplicidade + abertura ────────────────

async function handleNewProblem(
  authCtx: AuthContext,
  convId: string,
  text: string,
): Promise<void> {
  const classification = classifyProblem(text);
  const urgency = detectUrgency(text);

  // Duplicidade/reabertura contra os chamados do próprio funcionário.
  const tickets = await withRetry(() => listTickets(authCtx));
  const dedupe = detectDuplicate(
    { category: classification.category, text },
    tickets.map((t) => ({
      id: t.id,
      category: t.category,
      status: t.status,
      text: `${t.title} ${t.description}`,
      resolvedAt: t.resolvedAt,
    })),
  );

  const problem: PendingProblem = {
    text,
    type: classification.type,
    category: classification.category,
    subcategory: classification.subcategory,
    title: classification.title,
    description: text.trim(),
    affected: detectAffected(text),
    workBlocked: urgency.workBlocked,
    sameDayCommitment: urgency.sameDayCommitment,
    dedupeAction: dedupe.action,
    targetTicketId: dedupe.ticketId,
  };

  // Já existe chamado aberto equivalente → atualizar (com confirmação).
  if (dedupe.action === "update" && dedupe.ticketId) {
    await buildDraftAndAsk(authCtx, convId, problem, {
      statusLine: ["consultou seus chamados"],
      intro: `Já existe um chamado aberto sobre isso (${dedupe.ticketId}). Em vez de abrir outro, vou atualizá-lo. Confira:`,
    });
    return;
  }
  // Resolvido há pouco → reabrir (com confirmação).
  if (dedupe.action === "reopen" && dedupe.ticketId) {
    await buildDraftAndAsk(authCtx, convId, problem, {
      statusLine: ["consultou seus chamados"],
      intro: `Havia um chamado resolvido há poucos dias sobre isso (${dedupe.ticketId}). Posso reabri-lo em vez de criar um novo. Confira:`,
    });
    return;
  }

  // Sem duplicidade → tentar resolver pela central de ajuda.
  const hits = searchArticles(text, { limit: 3 });
  const top = hits[0];
  const articleApplies = top && top.article.osScope === null && !urgency.workBlocked;

  if (top && articleApplies) {
    await answerWithArticle(authCtx, convId, text, problem);
    return;
  }

  // Artigo com ressalva de SO (ex.: erro 809 só no Windows 10) → vai para chamado.
  if (top && top.article.osScope !== null) {
    problem.caveat = `o artigo "${top.article.title}" vale só para ${top.article.osScope}`;
  }

  await buildDraftAndAsk(authCtx, convId, problem, {
    statusLine: ["consultou seus chamados", "buscou na central de ajuda"],
  });
}

async function answerWithArticle(
  authCtx: AuthContext,
  convId: string,
  text: string,
  problem: PendingProblem,
): Promise<void> {
  const history = listMessages(convId);
  const llmAnswer = await answerFreeform(authCtx, history, text);

  const hits = searchArticles(text, { limit: 1 });
  const article = hits[0]?.article;
  const fallback = article
    ? `${firstSentences(article.body, 2)}`
    : "Vou verificar como te ajudar com isso.";

  setAgentState(convId, { kind: "offered_article", problem });
  appendMessage(convId, {
    role: "agent",
    authorName: "Nexo Assist",
    content: llmAnswer ?? fallback,
    meta: {
      statusLine: ["buscou na central de ajuda"],
      chips: [
        { id: "ok", label: "Isso resolveu", action: "resolved_ok" },
        { id: "open", label: "Abrir um chamado", action: "open_ticket" },
      ],
    },
  });
}

function firstSentences(text: string, n: number): string {
  const parts = text.split(/(?<=[.!?])\s+/).slice(0, n);
  return parts.join(" ");
}

// ── Montar rascunho / pedir "afetados" ──────────────────────────────────────

interface DraftPresentation {
  statusLine?: string[];
  intro?: string;
}

async function buildDraftAndAsk(
  authCtx: AuthContext,
  convId: string,
  problem: PendingProblem,
  presentation: DraftPresentation = {},
): Promise<void> {
  // Falta "afetados" → perguntar com chips (necessário para classificar).
  if (!problem.affected) {
    setAgentState(convId, { kind: "awaiting_affected", problem });
    const caveat = problem.caveat
      ? `Não há chamado aberto sobre isso, e ${problem.caveat}. Vou abrir um chamado. `
      : "";
    appendMessage(convId, {
      role: "agent",
      authorName: "Nexo Assist",
      content: `${caveat}Quem está sendo afetado?`,
      meta: {
        statusLine: presentation.statusLine ?? ["consultou seus chamados", "buscou na central de ajuda"],
        chips: affectedChips(),
      },
    });
    return;
  }

  // Classificar prioridade e montar o rascunho.
  const priority = classifyPriority({
    type: problem.type,
    affected: problem.affected,
    workBlocked: problem.workBlocked,
    sameDayCommitment: problem.sameDayCommitment,
  });
  const now = new Date();
  const dueAt = computeDueAt(now, priority).toISOString();

  // Para update/reopen, herda dados do chamado alvo.
  let title = problem.title;
  let category = problem.category;
  let subcategory = problem.subcategory;
  if (problem.targetTicketId && problem.dedupeAction !== "create") {
    try {
      const target = await withRetry(() => getTicket(authCtx, problem.targetTicketId!));
      title = target.title;
      category = target.category;
      subcategory = target.subcategory;
    } catch {
      /* mantém dados inferidos se não conseguir ler o alvo */
    }
  }

  const draft: TicketDraft = {
    draftId: nextDraftId(),
    type: problem.type,
    title,
    description: problem.description,
    category,
    subcategory,
    priority,
    affected: problem.affected,
    dueAt,
    updatesTicketId:
      problem.dedupeAction !== "create" ? problem.targetTicketId : undefined,
  };

  setAgentState(convId, { kind: "awaiting_confirmation", problem, draft });

  const reason =
    priority === "alta" && problem.sameDayCommitment
      ? "Coloquei prioridade alta por causa do compromisso de hoje"
      : `Classifiquei como prioridade ${PRIORITY_LABEL[priority].toLowerCase()}`;
  const intro =
    presentation.intro ??
    `${reason} — a resposta chega dentro do prazo (até ${formatTime(dueAt)}). Confira antes de eu ${draft.updatesTicketId ? "atualizar" : "criar"}:`;

  appendMessage(convId, {
    role: "agent",
    authorName: "Nexo Assist",
    content: intro,
    meta: {
      statusLine: ["classificou a prioridade", "consultou o SLA", "montou o rascunho"],
      draft,
    },
  });
}

function affectedChips(): ChatChip[] {
  return [
    { id: "a1", label: "Só eu", action: "affected:somente_eu" },
    { id: "a2", label: "Minha equipe", action: "affected:minha_equipe" },
    { id: "a3", label: "Toda a empresa", action: "affected:toda_empresa" },
    { id: "a4", label: "Não sei", action: "affected:nao_sei" },
  ];
}

// ── Confirmar rascunho → criar / atualizar / reabrir ────────────────────────

async function confirmDraft(
  authCtx: AuthContext,
  convId: string,
  problem: PendingProblem,
  draft: TicketDraft,
): Promise<void> {
  let ticket: Ticket;
  let verb: string;

  if (draft.updatesTicketId && problem.dedupeAction === "reopen") {
    ticket = await withRetry(() => reopenTicket(authCtx, draft.updatesTicketId!));
    ticket = await withRetry(() =>
      updateTicket(
        authCtx,
        ticket.id,
        { description: `${ticket.description}\n\n[Reaberto] ${problem.description}`, priority: draft.priority },
        "Nexo Assist",
        "Reaberto pelo funcionário via Nexo Assist.",
      ),
    );
    verb = "Reabri";
  } else if (draft.updatesTicketId && problem.dedupeAction === "update") {
    ticket = await withRetry(() =>
      updateTicket(
        authCtx,
        draft.updatesTicketId!,
        {
          description: undefined, // mantém; anexamos abaixo
          priority: draft.priority,
          affected: draft.affected,
        },
        "Nexo Assist",
        `Atualização do funcionário: ${problem.description}`,
      ),
    );
    verb = "Atualizei";
  } else {
    ticket = await withRetry(() =>
      createTicket(authCtx, {
        type: draft.type,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        subcategory: draft.subcategory,
        priority: draft.priority,
        affected: draft.affected,
      }),
    );
    verb = "Abri";
  }

  setAgentState(convId, { kind: "idle" });
  updateConversation(convId, { relatedTicketId: ticket.id });

  appendMessage(convId, {
    role: "agent",
    authorName: "Nexo Assist",
    content: `Pronto: ${verb.toLowerCase()} o chamado ${ticket.id} com prioridade ${PRIORITY_LABEL[ticket.priority].toLowerCase()}. Um analista responde dentro do prazo (até ${formatTime(ticket.dueAt)}).`,
    meta: {
      statusLine: [verb === "Abri" ? "criou um chamado" : "atualizou o chamado"],
      ticketCard: ticketToCard(ticket),
    },
  });
}

// ── Consulta de status ──────────────────────────────────────────────────────

async function handleStatusQuery(
  authCtx: AuthContext,
  convId: string,
): Promise<void> {
  const tickets = await withRetry(() => listTickets(authCtx));
  const open = tickets.filter((t) => t.status !== "resolved");

  if (open.length === 0) {
    agentSay(
      convId,
      "Você não tem chamados abertos no momento. Quer abrir um novo ou saber de algum já resolvido?",
      ["consultou seus chamados"],
    );
    return;
  }

  if (open.length === 1) {
    await showTicketStatus(authCtx, convId, open[0]!.id);
    return;
  }

  const picker: TicketPickerItem[] = open.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    createdAt: t.createdAt,
  }));
  setAgentState(convId, { kind: "awaiting_status_selection" });
  appendMessage(convId, {
    role: "agent",
    authorName: "Nexo Assist",
    content: `Você tem ${open.length} chamados abertos. Sobre qual deles quer saber?`,
    meta: { statusLine: ["consultou seus chamados"], ticketPicker: picker },
  });
}

async function showTicketStatus(
  authCtx: AuthContext,
  convId: string,
  ticketId: string,
): Promise<void> {
  const ticket = await withRetry(() => getTicket(authCtx, ticketId));
  const overdue = ticket.overdue || isOverdue(ticket);

  setAgentState(convId, { kind: "idle" });
  updateConversation(convId, { relatedTicketId: ticket.id });

  appendMessage(convId, {
    role: "agent",
    authorName: "Nexo Assist",
    content: `Aqui está o ${ticket.id}.`,
    meta: {
      statusLine: [`consultou o ${ticket.id}`, "calculou o prazo"],
      ticketCard: ticketToCard(ticket),
    },
  });

  // Vencido → oferecer transferência (Anexo A: vencido é gatilho de transferência).
  const decision = shouldTransfer({
    userRequested: false,
    priority: ticket.priority,
    ticketOverdue: overdue,
    agentConfidence: 0.9,
  });
  if (decision.transfer) {
    appendMessage(convId, {
      role: "agent",
      authorName: "Nexo Assist",
      content:
        overdue
          ? "Está sem atualização acima do prazo. Quer que eu chame um analista?"
          : "Posso acionar um analista se preferir. O que deseja?",
      meta: {
        chips: [
          { id: "t1", label: "Falar com um analista", action: "transfer" },
          { id: "t2", label: "Adicionar informação", action: "add_info" },
          { id: "t3", label: "Não, obrigado", action: "decline" },
        ],
      },
    });
  }
}

// ── Transferência ────────────────────────────────────────────────────────────

async function transferToAnalyst(
  authCtx: AuthContext,
  convId: string,
  summary: string,
): Promise<void> {
  const conv = getConversation(convId)!;

  appendMessage(convId, {
    role: "agent",
    authorName: "Nexo Assist",
    content:
      "Encaminhei para o Suporte N2. Um analista vai falar com você em até 2h úteis.",
    meta: { statusLine: ["transferiu para um analista"] },
  });
  appendMessage(convId, {
    role: "system",
    authorName: null,
    content: "Transferida para Suporte N2",
  });

  // Transfere também o chamado em foco, se houver.
  if (conv.relatedTicketId) {
    try {
      await withRetry(() =>
        transferTicket(authCtx, conv.relatedTicketId!, {
          analystTier: "Suporte N2",
          summary,
        }),
      );
    } catch {
      /* transferência de UI acontece mesmo que o serviço falhe momentaneamente */
    }
  }

  setAgentState(convId, { kind: "idle" });
  updateConversation(convId, {
    status: "awaiting_analyst",
    confidence: Math.min(conv.confidence, 0.5),
  });
}

// ── util ─────────────────────────────────────────────────────────────────────

function agentSay(convId: string, content: string, statusLine?: string[]): void {
  appendMessage(convId, {
    role: "agent",
    authorName: "Nexo Assist",
    content,
    meta: statusLine ? { statusLine } : null,
  });
}
