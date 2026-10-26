import type Database from "better-sqlite3";

/**
 * Dados de exemplo realistas (pt-BR). As datas são relativas a "agora" para que
 * a lógica temporal (chamado vencido, janela de reabertura de 7 dias) permaneça
 * verdadeira independentemente de quando o avaliador rodar o projeto — por isso
 * os rótulos absolutos podem divergir das capturas de tela do protótipo.
 */

const now = () => new Date();
const iso = (d: Date) => d.toISOString();

function daysAgo(n: number, hour = 10, minute = 0): string {
  const d = now();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return iso(d);
}
function hoursAgo(n: number): string {
  const d = now();
  d.setHours(d.getHours() - n);
  return iso(d);
}
function minutesAgo(n: number): string {
  const d = now();
  d.setMinutes(d.getMinutes() - n);
  return iso(d);
}

// Senha de demonstração compartilhada por todos os usuários (ver README).
const DEMO_PASSWORD = "nexo123";

interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: "employee" | "analyst";
  department: string | null;
  analystTier: string | null;
  passwordChangedAt: string;
  avatarInitials: string;
}

const users: SeedUser[] = [
  {
    id: "u-ana",
    name: "Ana Souza",
    email: "ana.souza@nexo.com.br",
    role: "employee",
    department: "Financeiro",
    analystTier: null,
    passwordChangedAt: daysAgo(42),
    avatarInitials: "AS",
  },
  {
    id: "u-bruno",
    name: "Bruno Tavares",
    email: "bruno.tavares@nexo.com.br",
    role: "employee",
    department: "Comercial",
    analystTier: null,
    passwordChangedAt: daysAgo(12),
    avatarInitials: "BT",
  },
  {
    id: "u-carla",
    name: "Carla Mendes",
    email: "carla.mendes@nexo.com.br",
    role: "employee",
    department: "Controladoria",
    analystTier: null,
    passwordChangedAt: daysAgo(70),
    avatarInitials: "CM",
  },
  {
    id: "u-diego",
    name: "Diego Ramos",
    email: "diego.ramos@nexo.com.br",
    role: "employee",
    department: "Marketing",
    analystTier: null,
    passwordChangedAt: daysAgo(5),
    avatarInitials: "DR",
  },
  {
    id: "u-elisa",
    name: "Elisa Prado",
    email: "elisa.prado@nexo.com.br",
    role: "employee",
    department: "Operações",
    analystTier: null,
    passwordChangedAt: daysAgo(23),
    avatarInitials: "EP",
  },
  {
    id: "u-fabio",
    name: "Fábio Nunes",
    email: "fabio.nunes@nexo.com.br",
    role: "employee",
    department: "Jurídico",
    analystTier: null,
    passwordChangedAt: daysAgo(90),
    avatarInitials: "FN",
  },
  {
    id: "u-gabriela",
    name: "Gabriela Rocha",
    email: "gabriela.rocha@nexo.com.br",
    role: "employee",
    department: "Logística",
    analystTier: null,
    passwordChangedAt: daysAgo(15),
    avatarInitials: "GR",
  },
  {
    id: "u-rafael",
    name: "Rafael Lima",
    email: "rafael.lima@nexo.com.br",
    role: "analyst",
    department: "Service Desk",
    analystTier: "Suporte N2",
    passwordChangedAt: daysAgo(30),
    avatarInitials: "RL",
  },
  {
    id: "u-juliana",
    name: "Juliana Dias",
    email: "juliana.dias@nexo.com.br",
    role: "analyst",
    department: "Service Desk",
    analystTier: "Suporte N1",
    passwordChangedAt: daysAgo(18),
    avatarInitials: "JD",
  },
];

interface SeedArticle {
  id: string;
  title: string;
  body: string;
  category: string;
  keywords: string[];
  osScope: string | null;
}

const articles: SeedArticle[] = [
  {
    id: "kb-vpn-809",
    title: "VPN: erro 809 ao conectar",
    body: "O erro 809 indica que o túnel VPN foi bloqueado por firewall ou NAT. No Windows 10, reinstalar o cliente VPN da Nexo (versão mais recente do portal interno) resolve na maioria dos casos. ATENÇÃO: no Windows 11 a reinstalação NÃO resolve por conta de uma incompatibilidade conhecida do driver — abra um chamado para o service desk ajustar a política de rede manualmente.",
    category: "Rede e VPN",
    keywords: ["vpn", "erro 809", "809", "conexao", "túnel", "tunel", "firewall"],
    osScope: "Windows 10",
  },
  {
    id: "kb-horario",
    title: "Horário de atendimento do service desk",
    body: "O service desk de TI atende de segunda a sexta, das 8h às 18h. Fora desse horário há plantão 24h apenas para chamados de prioridade crítica (algo parado para uma equipe ou para a empresa inteira). Chamados não críticos abertos fora do horário entram na fila do próximo dia útil.",
    category: "Outros",
    keywords: ["horário", "horario", "atendimento", "plantão", "plantao", "24h", "funcionamento"],
    osScope: null,
  },
  {
    id: "kb-senha-rede",
    title: "Como redefinir a senha da rede Nexo",
    body: "Acesse o portal senha.nexo.com.br e informe seu e-mail corporativo para receber um link de redefinição. A nova senha precisa ter no mínimo 10 caracteres, com letras, números e um símbolo. Se o link não chegar em 10 minutos, verifique a caixa de spam ou abra um chamado na categoria Acesso.",
    category: "Acesso",
    keywords: ["senha", "redefinir", "resetar", "esqueci", "senha da rede", "acesso"],
    osScope: null,
  },
  {
    id: "kb-email-celular",
    title: "Configurar o e-mail corporativo no celular",
    body: "Instale o aplicativo Microsoft Outlook, toque em Adicionar conta e informe seu e-mail @nexo.com.br. A autenticação usa o login único da Nexo (SSO) com verificação em duas etapas. Caso o celular peça servidor manual, use outlook.office365.com.",
    category: "E-mail",
    keywords: ["email", "e-mail", "celular", "outlook", "configurar", "sincronizar", "mobile"],
    osScope: null,
  },
  {
    id: "kb-monitor-home",
    title: "Solicitar segundo monitor ou equipamento para home office",
    body: "Pedidos de equipamento para home office (monitor, teclado, headset) são requisições (REQ) e passam por aprovação do gestor. Prioridade padrão baixa, prazo de 5 dias úteis. Informe o endereço de entrega no chamado. Monitores são enviados por transportadora em até 7 dias após a aprovação.",
    category: "Hardware",
    keywords: ["monitor", "home office", "equipamento", "teclado", "headset", "requisição", "requisicao"],
    osScope: null,
  },
  {
    id: "kb-wifi",
    title: "Wi-Fi corporativo não conecta",
    body: "A rede Nexo-Corp usa autenticação por certificado. Se o notebook não conectar, esqueça a rede e reconecte usando seu login da rede. A senha do Wi-Fi para visitantes (Nexo-Guest) é rotativa e enviada pelo service desk mediante solicitação. Em caso de falha de certificado, abra um chamado.",
    category: "Rede e VPN",
    keywords: ["wifi", "wi-fi", "rede sem fio", "nexo-corp", "certificado", "conectar"],
    osScope: null,
  },
  {
    id: "kb-sharepoint",
    title: "Liberar acesso a uma pasta no SharePoint",
    body: "O acesso a pastas do SharePoint (ex: Financeiro, Jurídico) é controlado por grupo. Abra um chamado na categoria Acesso informando a pasta e o motivo; o gestor responsável pela área precisa aprovar. Após a aprovação, a liberação leva cerca de 1 dia útil.",
    category: "Acesso",
    keywords: ["sharepoint", "pasta", "acesso", "permissão", "permissao", "financeiro", "compartilhada"],
    osScope: null,
  },
  {
    id: "kb-notebook-lento",
    title: "Notebook lento após atualização do Windows",
    body: "Lentidão logo após uma grande atualização costuma ser a indexação e a reinstalação de drivers rodando em segundo plano — aguarde algumas horas com o notebook ligado. Se persistir após 24h, reinicie e rode o Diagnóstico da Central de TI. Permanecendo lento, abra um chamado de Hardware para análise do driver de vídeo.",
    category: "Hardware",
    keywords: ["notebook", "lento", "lentidão", "lentidao", "atualização", "atualizacao", "windows", "desempenho"],
    osScope: null,
  },
  {
    id: "kb-software-homologado",
    title: "Instalar um software da lista homologada",
    body: "Softwares homologados (ex: Chrome, 7-Zip, Power BI) podem ser instalados sozinho pelo Portal de Software da Nexo, sem chamado. Softwares fora da lista exigem uma requisição (REQ) na categoria Software com justificativa, por conta de licenciamento e segurança.",
    category: "Software",
    keywords: ["software", "instalar", "programa", "homologado", "portal de software", "licença", "licenca"],
    osScope: null,
  },
  {
    id: "kb-mfa",
    title: "Autenticação em duas etapas (MFA)",
    body: "A Nexo exige verificação em duas etapas via app Microsoft Authenticator. Ao trocar de celular, registre o novo aparelho em mfa.nexo.com.br antes de apagar o antigo. Se perdeu o acesso ao segundo fator, abra um chamado na categoria Acesso para desbloqueio pelo service desk.",
    category: "Acesso",
    keywords: ["mfa", "duas etapas", "autenticação", "autenticacao", "authenticator", "segundo fator", "2fa"],
    osScope: null,
  },
];

interface SeedTicket {
  id: string;
  type: "INC" | "REQ";
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  priority: "critica" | "alta" | "media" | "baixa";
  affected: "somente_eu" | "minha_equipe" | "toda_empresa" | "nao_sei";
  status: "open" | "in_progress" | "awaiting_analyst" | "approved" | "resolved";
  requesterId: string;
  assignedAnalystId: string | null;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  overdue: boolean;
}

const tickets: SeedTicket[] = [
  // ── Ana Souza (usuária demo principal) ──────────────────────────────────
  {
    id: "INC-20311",
    type: "INC",
    title: "Notebook lento após atualização do Windows",
    description:
      "Lentidão geral desde a atualização de duas semanas atrás. Reiniciar e rodar o diagnóstico da central não resolveu.",
    category: "Hardware",
    subcategory: "Notebook",
    priority: "media",
    affected: "somente_eu",
    status: "awaiting_analyst",
    requesterId: "u-ana",
    assignedAnalystId: null,
    createdAt: daysAgo(10, 14, 20),
    updatedAt: daysAgo(5, 9, 10),
    dueAt: daysAgo(5, 9, 10), // prazo de 3 dias úteis já estourado
    resolvedAt: null,
    overdue: true,
  },
  {
    id: "INC-20298",
    type: "INC",
    title: "Acesso à pasta Financeiro no SharePoint",
    description:
      "Não consigo abrir a pasta compartilhada do Financeiro no SharePoint; aparece 'acesso negado'.",
    category: "Acesso",
    subcategory: "SharePoint",
    priority: "media",
    affected: "somente_eu",
    status: "in_progress",
    requesterId: "u-ana",
    assignedAnalystId: "u-juliana",
    createdAt: daysAgo(12, 11, 5),
    updatedAt: daysAgo(1, 16, 30),
    dueAt: daysAgo(-2, 11, 5),
    resolvedAt: null,
    overdue: false,
  },
  {
    id: "REQ-10442",
    type: "REQ",
    title: "Segundo monitor para home office",
    description:
      "Gostaria de um segundo monitor para o home office, para trabalhar com as planilhas abertas lado a lado.",
    category: "Hardware",
    subcategory: "Periféricos",
    priority: "baixa",
    affected: "somente_eu",
    status: "approved",
    requesterId: "u-ana",
    assignedAnalystId: "u-rafael",
    createdAt: daysAgo(17, 9, 40),
    updatedAt: daysAgo(6, 10, 0),
    dueAt: daysAgo(-8, 9, 40),
    resolvedAt: null,
    overdue: false,
  },
  {
    id: "INC-20455",
    type: "INC",
    title: "Impressora do 3º andar sem conexão",
    description:
      "A impressora compartilhada do 3º andar parou de aparecer na lista de impressoras.",
    category: "Hardware",
    subcategory: "Impressora",
    priority: "media",
    affected: "minha_equipe",
    status: "resolved",
    requesterId: "u-ana",
    assignedAnalystId: "u-rafael",
    createdAt: daysAgo(8, 9, 0),
    updatedAt: daysAgo(3, 15, 0),
    dueAt: daysAgo(3, 9, 0),
    resolvedAt: daysAgo(3, 15, 0), // resolvido há 3 dias → reabertura possível
    overdue: false,
  },
  {
    id: "INC-19877",
    type: "INC",
    title: "Outlook não sincroniza no celular",
    description: "O Outlook do celular parou de receber e-mails novos.",
    category: "E-mail",
    subcategory: null,
    priority: "media",
    affected: "somente_eu",
    status: "resolved",
    requesterId: "u-ana",
    assignedAnalystId: "u-juliana",
    createdAt: daysAgo(54, 10, 0),
    updatedAt: daysAgo(53, 11, 0),
    dueAt: daysAgo(51, 10, 0),
    resolvedAt: daysAgo(53, 11, 0), // resolvido há muito tempo → não reabre
    overdue: false,
  },
  {
    id: "INC-19410",
    type: "INC",
    title: "Troca de senha da rede",
    description: "Esqueci a senha da rede e precisei redefinir.",
    category: "Acesso",
    subcategory: null,
    priority: "alta",
    affected: "somente_eu",
    status: "resolved",
    requesterId: "u-ana",
    assignedAnalystId: "u-juliana",
    createdAt: daysAgo(107, 8, 30),
    updatedAt: daysAgo(107, 9, 0),
    dueAt: daysAgo(107, 12, 30),
    resolvedAt: daysAgo(107, 9, 0),
    overdue: false,
  },

  // ── Outros funcionários (variedade p/ console e testes) ──────────────────
  {
    id: "REQ-10448",
    type: "REQ",
    title: "Acesso ao SAP para fechamento",
    description:
      "Preciso de acesso ao módulo financeiro do SAP ainda hoje para o fechamento do mês.",
    category: "Acesso",
    subcategory: "SAP",
    priority: "alta",
    affected: "somente_eu",
    status: "awaiting_analyst",
    requesterId: "u-carla",
    assignedAnalystId: null,
    createdAt: hoursAgo(3),
    updatedAt: minutesAgo(30),
    dueAt: hoursAgo(-1),
    resolvedAt: null,
    overdue: false,
  },
  {
    id: "INC-20502",
    type: "INC",
    title: "ERP de vendas fora do ar para a equipe",
    description:
      "Toda a equipe comercial está sem acesso ao ERP de vendas; ninguém consegue registrar pedidos.",
    category: "Software",
    subcategory: "ERP",
    priority: "critica",
    affected: "minha_equipe",
    status: "awaiting_analyst",
    requesterId: "u-bruno",
    assignedAnalystId: null,
    createdAt: minutesAgo(50),
    updatedAt: minutesAgo(40),
    dueAt: minutesAgo(-10), // crítico, prazo 1h
    resolvedAt: null,
    overdue: false,
  },
  {
    id: "INC-20480",
    type: "INC",
    title: "Microsoft Teams não abre",
    description: "O Teams não abre no desktop; fica na tela de carregamento.",
    category: "Software",
    subcategory: "Teams",
    priority: "media",
    affected: "somente_eu",
    status: "resolved",
    requesterId: "u-bruno",
    assignedAnalystId: "u-juliana",
    createdAt: daysAgo(6, 9, 0),
    updatedAt: daysAgo(2, 14, 0),
    dueAt: daysAgo(2, 9, 0),
    resolvedAt: daysAgo(2, 14, 0), // reabrível
    overdue: false,
  },
  {
    id: "INC-20519",
    type: "INC",
    title: "Teclado do notebook com teclas falhando",
    description: "Algumas teclas do notebook pararam de responder.",
    category: "Hardware",
    subcategory: "Notebook",
    priority: "media",
    affected: "somente_eu",
    status: "open",
    requesterId: "u-elisa",
    assignedAnalystId: null,
    createdAt: minutesAgo(8),
    updatedAt: minutesAgo(8),
    dueAt: daysAgo(-3, 10, 0),
    resolvedAt: null,
    overdue: false,
  },
  {
    id: "INC-20470",
    type: "INC",
    title: "E-mails presos na caixa de saída",
    description: "Os e-mails ficam presos na caixa de saída e não enviam.",
    category: "E-mail",
    subcategory: null,
    priority: "media",
    affected: "somente_eu",
    status: "resolved",
    requesterId: "u-fabio",
    assignedAnalystId: null,
    createdAt: daysAgo(2, 9, 30),
    updatedAt: minutesAgo(25),
    dueAt: daysAgo(-1, 9, 30),
    resolvedAt: minutesAgo(25), // resolvido pelo agent
    overdue: false,
  },
  {
    id: "INC-20388",
    type: "INC",
    title: "Senha do Wi-Fi de visitantes",
    description: "Precisava da senha do Wi-Fi para um visitante na recepção.",
    category: "Rede e VPN",
    subcategory: "Wi-Fi",
    priority: "baixa",
    affected: "somente_eu",
    status: "resolved",
    requesterId: "u-gabriela",
    assignedAnalystId: null,
    createdAt: daysAgo(1, 17, 0),
    updatedAt: daysAgo(1, 17, 5),
    dueAt: daysAgo(-4, 17, 0),
    resolvedAt: daysAgo(1, 17, 5),
    overdue: false,
  },
];

interface SeedConversation {
  id: string;
  employeeId: string;
  status: "agent" | "awaiting_analyst" | "analyst" | "resolved";
  assignedAnalystId: string | null;
  confidence: number;
  transferNote: string | null;
  unreadCount: number;
  relatedTicketId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SeedMessage {
  conversationId: string;
  role: "user" | "agent" | "analyst" | "system";
  authorName: string | null;
  content: string;
  meta: unknown | null;
  createdAt: string;
}

const conversations: SeedConversation[] = [
  {
    id: "conv-ana",
    employeeId: "u-ana",
    status: "awaiting_analyst",
    assignedAnalystId: null,
    confidence: 0.52,
    transferNote: null,
    unreadCount: 2,
    relatedTicketId: "INC-20311",
    createdAt: minutesAgo(25),
    updatedAt: minutesAgo(5),
  },
  {
    id: "conv-carla",
    employeeId: "u-carla",
    status: "awaiting_analyst",
    assignedAnalystId: null,
    confidence: 0.6,
    transferNote: "contato em 25 min",
    unreadCount: 1,
    relatedTicketId: "REQ-10448",
    createdAt: minutesAgo(35),
    updatedAt: minutesAgo(7),
  },
  {
    id: "conv-bruno",
    employeeId: "u-bruno",
    status: "awaiting_analyst",
    assignedAnalystId: null,
    confidence: 0.41,
    transferNote: null,
    unreadCount: 0,
    relatedTicketId: "INC-20502",
    createdAt: minutesAgo(50),
    updatedAt: minutesAgo(14),
  },
  {
    id: "conv-diego",
    employeeId: "u-diego",
    status: "agent",
    assignedAnalystId: null,
    confidence: 0.9,
    transferNote: null,
    unreadCount: 0,
    relatedTicketId: null,
    createdAt: minutesAgo(4),
    updatedAt: minutesAgo(1),
  },
  {
    id: "conv-elisa",
    employeeId: "u-elisa",
    status: "agent",
    assignedAnalystId: null,
    confidence: 0.88,
    transferNote: null,
    unreadCount: 0,
    relatedTicketId: "INC-20519",
    createdAt: minutesAgo(12),
    updatedAt: minutesAgo(2),
  },
  {
    id: "conv-fabio",
    employeeId: "u-fabio",
    status: "resolved",
    assignedAnalystId: null,
    confidence: 0.95,
    transferNote: null,
    unreadCount: 0,
    relatedTicketId: "INC-20470",
    createdAt: daysAgo(0, 9, 55),
    updatedAt: minutesAgo(25),
  },
  {
    id: "conv-gabriela",
    employeeId: "u-gabriela",
    status: "resolved",
    assignedAnalystId: null,
    confidence: 0.97,
    transferNote: null,
    unreadCount: 0,
    relatedTicketId: "INC-20388",
    createdAt: daysAgo(1, 16, 50),
    updatedAt: daysAgo(1, 17, 5),
  },
];

// Histórico completo da conversa da Ana (reproduz telas 3/4/5).
const anaMessages: SeedMessage[] = [
  {
    conversationId: "conv-ana",
    role: "user",
    authorName: "Ana Souza",
    content: "Qual o status do meu chamado?",
    meta: null,
    createdAt: minutesAgo(23),
  },
  {
    conversationId: "conv-ana",
    role: "agent",
    authorName: "Nexo Assist",
    content: "Você tem 3 chamados abertos. Sobre qual deles quer saber?",
    meta: { statusLine: ["consultou seus chamados"] },
    createdAt: minutesAgo(23),
  },
  {
    conversationId: "conv-ana",
    role: "user",
    authorName: "Ana Souza",
    content: "INC-20311 · Notebook lento após atualização",
    meta: null,
    createdAt: minutesAgo(22),
  },
  {
    conversationId: "conv-ana",
    role: "agent",
    authorName: "Nexo Assist",
    content:
      "Está sem atualização há 5 dias, acima do prazo de 3 dias úteis para prioridade média. Quer que eu chame um analista?",
    meta: {
      statusLine: ["consultou o INC-20311", "calculou o prazo"],
      chips: [
        { id: "c1", label: "Falar com um analista", action: "transfer" },
        { id: "c2", label: "Adicionar informação", action: "add_info" },
        { id: "c3", label: "Não, obrigado", action: "decline" },
      ],
    },
    createdAt: minutesAgo(21),
  },
  {
    conversationId: "conv-ana",
    role: "user",
    authorName: "Ana Souza",
    content: "Está parado há 5 dias.",
    meta: null,
    createdAt: minutesAgo(7),
  },
  {
    conversationId: "conv-ana",
    role: "user",
    authorName: "Ana Souza",
    content: "Quero falar com um analista.",
    meta: null,
    createdAt: minutesAgo(6),
  },
  {
    conversationId: "conv-ana",
    role: "agent",
    authorName: "Nexo Assist",
    content:
      "Encaminhei para o Suporte N2. Um analista vai falar com você em até 2 h úteis.",
    meta: { statusLine: ["transferiu para um analista"] },
    createdAt: minutesAgo(5),
  },
  {
    conversationId: "conv-ana",
    role: "system",
    authorName: null,
    content: "Transferida para Suporte N2",
    meta: null,
    createdAt: minutesAgo(5),
  },
];

const otherMessages: SeedMessage[] = [
  {
    conversationId: "conv-carla",
    role: "user",
    authorName: "Carla Mendes",
    content: "Preciso de acesso ao SAP ainda hoje, é para o fechamento.",
    meta: null,
    createdAt: minutesAgo(8),
  },
  {
    conversationId: "conv-bruno",
    role: "agent",
    authorName: "Nexo Assist",
    content: "Vou chamar um analista para isso.",
    meta: null,
    createdAt: minutesAgo(14),
  },
  {
    conversationId: "conv-diego",
    role: "user",
    authorName: "Diego Ramos",
    content: "Oi, meu mouse sem fio parou de funcionar.",
    meta: null,
    createdAt: minutesAgo(1),
  },
  {
    conversationId: "conv-elisa",
    role: "agent",
    authorName: "Nexo Assist",
    content: "Pronto: criei o chamado INC-20519 para o teclado.",
    meta: { statusLine: ["criou um chamado"] },
    createdAt: minutesAgo(2),
  },
  {
    conversationId: "conv-fabio",
    role: "user",
    authorName: "Fábio Nunes",
    content: "Isso resolveu, obrigado!",
    meta: null,
    createdAt: minutesAgo(25),
  },
  {
    conversationId: "conv-gabriela",
    role: "agent",
    authorName: "Nexo Assist",
    content: "A senha do Wi-Fi foi enviada para o seu e-mail.",
    meta: null,
    createdAt: daysAgo(1, 17, 5),
  },
];

const counters: { name: string; value: number }[] = [
  { name: "INC", value: 20520 },
  { name: "REQ", value: 10448 },
];

export function seedDatabase(db: Database.Database): void {
  const tx = db.transaction(() => {
    const insUser = db.prepare(
      `INSERT INTO users (id, name, email, password, role, department, analyst_tier, password_changed_at, avatar_initials)
       VALUES (@id, @name, @email, @password, @role, @department, @analystTier, @passwordChangedAt, @avatarInitials)`,
    );
    for (const u of users) {
      insUser.run({ ...u, password: DEMO_PASSWORD });
    }

    const insArticle = db.prepare(
      `INSERT INTO help_articles (id, title, body, category, keywords, os_scope)
       VALUES (@id, @title, @body, @category, @keywords, @osScope)`,
    );
    for (const a of articles) {
      insArticle.run({ ...a, keywords: JSON.stringify(a.keywords) });
    }

    const insTicket = db.prepare(
      `INSERT INTO tickets (id, type, title, description, category, subcategory, priority, affected, status,
         requester_id, assigned_analyst_id, created_at, updated_at, due_at, resolved_at, overdue)
       VALUES (@id, @type, @title, @description, @category, @subcategory, @priority, @affected, @status,
         @requesterId, @assignedAnalystId, @createdAt, @updatedAt, @dueAt, @resolvedAt, @overdue)`,
    );
    const insEvent = db.prepare(
      `INSERT INTO ticket_events (ticket_id, type, message, actor, created_at)
       VALUES (@ticketId, @type, @message, @actor, @createdAt)`,
    );
    for (const t of tickets) {
      insTicket.run({ ...t, overdue: t.overdue ? 1 : 0 });
      insEvent.run({
        ticketId: t.id,
        type: "created",
        message: "Chamado aberto.",
        actor: "Nexo Assist",
        createdAt: t.createdAt,
      });
      if (t.resolvedAt) {
        insEvent.run({
          ticketId: t.id,
          type: "resolved",
          message: "Chamado resolvido.",
          actor: t.assignedAnalystId ? "Analista" : "Nexo Assist",
          createdAt: t.resolvedAt,
        });
      }
    }

    const insConv = db.prepare(
      `INSERT INTO conversations (id, employee_id, status, assigned_analyst_id, confidence, transfer_note,
         unread_count, related_ticket_id, created_at, updated_at)
       VALUES (@id, @employeeId, @status, @assignedAnalystId, @confidence, @transferNote,
         @unreadCount, @relatedTicketId, @createdAt, @updatedAt)`,
    );
    for (const c of conversations) {
      insConv.run(c);
    }

    const insMsg = db.prepare(
      `INSERT INTO messages (id, conversation_id, role, author_name, content, meta, created_at)
       VALUES (@id, @conversationId, @role, @authorName, @content, @meta, @createdAt)`,
    );
    let n = 0;
    for (const m of [...anaMessages, ...otherMessages]) {
      insMsg.run({
        id: `seed-msg-${++n}`,
        conversationId: m.conversationId,
        role: m.role,
        authorName: m.authorName,
        content: m.content,
        meta: m.meta ? JSON.stringify(m.meta) : null,
        createdAt: m.createdAt,
      });
    }

    const insCounter = db.prepare(
      `INSERT INTO counters (name, value) VALUES (@name, @value)`,
    );
    for (const c of counters) {
      insCounter.run(c);
    }
  });

  tx();
}
