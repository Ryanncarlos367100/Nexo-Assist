/**
 * NLU determinística (baseada em palavras-chave). Mapeia o texto livre do
 * funcionário para sinais estruturados que alimentam as REGRAS (rules.ts):
 * intenção, categoria/tipo, urgência e "afetados". É propositalmente simples e
 * testável; quando há LLM, ele cuida da redação — não destas classificações.
 */

import type {
  Affected,
  TicketCategory,
  TicketType,
} from "@/domain/types";

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function has(text: string, terms: string[]): boolean {
  const n = norm(text);
  return terms.some((t) => n.includes(norm(t)));
}

export type ChatIntent =
  | "status"
  | "transfer"
  | "confirm"
  | "cancel"
  | "greeting"
  | "problem";

export function detectIntent(text: string): ChatIntent {
  if (has(text, ["falar com analista", "um analista", "atendente", "falar com alguem", "pessoa de verdade", "humano", "suporte humano"]))
    return "transfer";
  if (has(text, ["status do", "meu chamado", "meus chamados", "andamento do", "como esta o chamado", "acompanhar chamado", "ver chamado"]))
    return "status";
  if (has(text, ["pode criar", "pode abrir", "confirmar", "confirmo", "pode confirmar", "ta certo", "esta certo", "pode mandar"]))
    return "confirm";
  if (has(text, ["cancelar", "nao abrir", "deixa pra la", "esquece", "nao precisa"]))
    return "cancel";
  if (norm(text).trim().length <= 3 || has(text, ["oi", "ola", "bom dia", "boa tarde", "boa noite"]))
    return "greeting";
  return "problem";
}

/** Detecta "afetados" a partir do texto, se expresso. */
export function detectAffected(text: string): Affected | null {
  if (has(text, ["toda a empresa", "empresa inteira", "todo mundo", "a empresa toda", "todos os setores"]))
    return "toda_empresa";
  if (has(text, ["minha equipe", "meu time", "o time todo", "a equipe", "meu setor", "meu departamento", "nosso time"]))
    return "minha_equipe";
  // Nota: não inferimos escopo a partir do dispositivo ("meu notebook") — isso
  // indica o aparelho, não quantas pessoas são afetadas. Exigimos a escolha.
  if (has(text, ["so eu", "somente eu", "apenas eu", "comigo", "só a mim", "me afeta"]))
    return "somente_eu";
  if (has(text, ["nao sei", "nao tenho certeza", "talvez", "nao faco ideia"]))
    return "nao_sei";
  return null;
}

export interface UrgencySignals {
  workBlocked: boolean;
  sameDayCommitment: boolean;
}

export function detectUrgency(text: string): UrgencySignals {
  const workBlocked = has(text, [
    "nao conecta", "nao funciona", "parou", "nao consigo", "sem acesso",
    "nao abre", "caiu", "travou", "fora do ar", "nao liga", "nao carrega",
    "impossivel trabalhar", "nao da pra trabalhar", "bloqueado", "indisponivel",
  ]);
  const sameDayCommitment = has(text, [
    "hoje", "agora", "ainda hoje", "ate as", "as 14h", "as 15h", "as 9h",
    "reuniao", "apresentacao", "cliente", "fechamento", "urgente", "para ja",
    "daqui a pouco", "em uma hora", "nas proximas horas",
  ]);
  return { workBlocked, sameDayCommitment };
}

interface CategoryRule {
  category: TicketCategory;
  subcategory?: string;
  terms: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: "Rede e VPN", subcategory: "VPN", terms: ["vpn", "erro 809", "tunel", "conexao remota"] },
  { category: "Rede e VPN", subcategory: "Wi-Fi", terms: ["wifi", "wi-fi", "rede sem fio", "internet caiu", "sem internet"] },
  { category: "E-mail", terms: ["email", "e-mail", "outlook", "caixa de entrada", "caixa de saida", "nao recebo email"] },
  { category: "Acesso", subcategory: "Senha", terms: ["senha", "login", "nao consigo entrar", "resetar senha", "redefinir senha", "bloqueado", "mfa", "autenticacao"] },
  { category: "Acesso", subcategory: "SharePoint", terms: ["sharepoint", "pasta compartilhada", "acesso a pasta", "permissao"] },
  { category: "Acesso", subcategory: "SAP", terms: ["sap", "acesso ao sistema", "acesso ao erp", "acesso ao sap"] },
  { category: "Hardware", subcategory: "Notebook", terms: ["notebook", "laptop", "maquina lenta", "notebook lento", "tela", "bateria"] },
  { category: "Hardware", subcategory: "Periféricos", terms: ["monitor", "teclado", "mouse", "headset", "impressora", "webcam", "fone"] },
  { category: "Software", terms: ["software", "programa", "instalar", "teams", "excel", "word", "licenca", "aplicativo", "sistema trava"] },
];

export interface ProblemClassification {
  type: TicketType;
  category: TicketCategory;
  subcategory: string | null;
  title: string;
}

const REQUEST_SIGNALS = [
  "quero", "preciso de", "gostaria", "solicitar", "poderia liberar",
  "liberar acesso", "pedir", "segundo monitor", "novo equipamento",
  "instalar", "comprar", "contratar",
];

/** Capitaliza e limita o texto para virar um título de chamado. */
function toTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  const firstSentence = clean.split(/[.!?]/)[0] ?? clean;
  const capped = firstSentence.length > 70 ? `${firstSentence.slice(0, 67)}…` : firstSentence;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

export function classifyProblem(text: string): ProblemClassification {
  let category: TicketCategory = "Outros";
  let subcategory: string | null = null;
  for (const rule of CATEGORY_RULES) {
    if (has(text, rule.terms)) {
      category = rule.category;
      subcategory = rule.subcategory ?? null;
      break;
    }
  }

  // Tipo: requisição se há sinal de pedido E não há sinal claro de falha.
  const isRequest = has(text, REQUEST_SIGNALS) && !detectUrgency(text).workBlocked;
  const type: TicketType = isRequest ? "REQ" : "INC";

  return { type, category, subcategory, title: toTitle(text) };
}
