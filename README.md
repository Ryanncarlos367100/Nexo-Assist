# Nexo Assist

Agent de atendimento de **service desk de TI em chat** para a Nexo (empresa
fictícia, ~2.000 funcionários). O funcionário conversa em linguagem natural e o
agent decide se **responde uma dúvida**, **consulta/atualiza um chamado**,
**abre um chamado novo (só após confirmação)** ou **transfere para um analista
humano**. Há também um **console do analista** para assumir conversas.

Desafio técnico — processo seletivo **Beyond the Bytes**.

---

## 1. Como rodar localmente

Pré-requisitos: **Node 20+** e **npm**. (Desenvolvido e testado no Node 22.)

```bash
# 1. Instale as dependências
npm install

# 2. Configure o ambiente
cp .env.example .env
#   -> edite o .env (veja a seção "Variável de API" abaixo). O app TAMBÉM roda
#      sem chave, em modo demo determinístico.

# 3. (Opcional) Semeie o banco explicitamente. Se pular, ele semeia sozinho no
#    primeiro acesso.
npm run db:seed

# 4. Suba a aplicação
npm run dev
#   -> http://localhost:3000
```

Outros comandos:

```bash
npm test          # roda os testes (Vitest)
npm run typecheck # checagem estrita de tipos (tsc --noEmit)
npm run db:reset  # apaga o SQLite e recria tudo com dados de exemplo
npm run build     # build de produção
```

### Contas de demonstração (senha `nexo123`)

| Papel | E-mail | Vê |
|------|--------|-----|
| Funcionária | `ana.souza@nexo.com.br` | Chat do funcionário (`/atendimento`) |
| Analista N2 | `rafael.lima@nexo.com.br` | Console do analista (`/console`) |
| Analista N1 | `juliana.dias@nexo.com.br` | Console do analista |

> Os campos de login já vêm **pré-preenchidos com a Ana** para facilitar a
> avaliação. As senhas são guardadas em texto no SQLite **de propósito** (é uma
> simulação de "senha da rede"); num sistema real seriam hashes + provedor de
> identidade.

### Variável de API (a única que você precisa preencher)

O provedor de LLM é configurável. Por padrão usamos **Google Gemini**. Para usar
o LLM de verdade, preencha no `.env`:

```bash
LLM_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=coloque-sua-chave-aqui   # https://aistudio.google.com/app/apikey
```

Para trocar de provedor, mude `LLM_PROVIDER` para `anthropic` ou `openai` e
preencha a chave correspondente (`ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`).
Opcionalmente defina `LLM_MODEL` para fixar o modelo.

**Sem nenhuma chave**, o app roda em **modo demo determinístico**: todas as
decisões (prioridade, duplicidade, transferência, prazos) e os fluxos de chamado
funcionam normalmente — apenas a redação das respostas usa texto fixo em vez de
ser gerada pelo LLM. Isso permite avaliar o projeto "out of the box".

---

## 2. Roteiro de teste rápido (o que clicar)

**Como Ana (funcionária) em `/atendimento`:**

1. **Abrir chamado (tela 2):** digite
   *"Meu notebook não conecta na VPN desde ontem. Aparece o erro 809."* → o
   agent vê que não há chamado aberto de VPN, nota que o artigo do erro 809 só
   vale para Windows 10 e pergunta **quem é afetado** (chips). Escolha **"Só eu"**
   e complemente *"Tenho reunião com um cliente às 14h"* → ele classifica como
   **Alta**, monta o **rascunho** e só cria após **Confirmar**.
2. **Consultar status + transferência (tela 3):** digite *"Qual o status do meu
   chamado?"* → seletor de chamados; escolha o **INC-20311** (vencido) → o agent
   mostra o card e oferece **falar com um analista**.
3. **Reabertura:** digite *"A impressora do 3º andar voltou a ficar sem
   conexão"* → como havia um chamado resolvido há 3 dias, ele propõe **reabrir**
   em vez de duplicar.
4. **Fora de escopo:** digite *"quero ver meu holerite"* → redireciona para o RH.

**Como Rafael (analista) em `/console` (telas 4 e 5):**

1. Selecione a conversa da **Ana** (aba "Para você") → histórico com a
   transferência.
2. Clique **Assumir atendimento** → o agent é pausado, o chamado em foco vai
   para *Em andamento* e você pode responder (bolhas verdes do analista).
3. **Devolver ao agent** ou **Encerrar atendimento** encerram o takeover.

> Dica: abra `/atendimento` (Ana) e `/console` (Rafael) em duas janelas. Ao
> transferir pela conversa da Ana, a conversa aparece no console; o console
> atualiza por *polling* a cada ~2,5s.

---

## 3. Arquitetura

Separação por camadas, com **fronteira de negócio explícita**: o frontend
**nunca** importa os serviços diretamente — tudo passa pelas **rotas de API**.

```
┌──────────────────────────────────────────────────────────────────┐
│  app/ (Next.js App Router)                                         │
│   • páginas: /login /atendimento /perfil /console                  │
│   • rotas de API: /api/auth, /api/chat, /api/tickets, /api/console │
│     (orquestram; SEM regra de negócio)                             │
└───────────────┬──────────────────────────────────────────────────┘
                │ (única porta de entrada do frontend)
┌───────────────▼──────────────────────────────────────────────────┐
│  agent/  — o "cérebro" do Nexo Assist                              │
│   • rules.ts   decisões PURAS (prioridade, SLA, duplicidade,       │
│                vencimento, transferência, escopo) — testáveis      │
│   • nlu.ts     classificação determinística do texto livre         │
│   • engine.ts  state machine da conversa (orquestra tudo)          │
│   • prompt.ts  prompt de sistema (Anexo A)                         │
│   • llm.ts     abstração de provedor (Google/Anthropic/OpenAI)     │
│   • tools.ts + nexoAgent.ts   Mastra Agent + tools p/ perguntas    │
│                               livres (linguagem natural)           │
└───────┬───────────────────────────────┬──────────────────────────┘
        │                               │
┌───────▼─────────────┐   ┌─────────────▼──────────────┐
│ services/            │   │ services/                   │
│  ticket-service      │   │  help-center, directory,    │
│  (chamados simulados,│   │  conversation-service       │
│   escopado, 2% falha)│   │                             │
└───────┬─────────────┘   └─────────────┬──────────────┘
        │                               │
┌───────▼───────────────────────────────▼──────────────────────────┐
│  db/  — SQLite (better-sqlite3), arquivo em ./data/nexo.db         │
│         schema.sql idempotente + seed pt-BR                        │
└───────────────────────────────────────────────────────────────────┘

domain/  — tipos e rótulos compartilhados (linguagem ubíqua do Anexo A)
```

**Por que essa separação?**

- **`services/ticket-service` isolado e sem acesso do frontend.** É uma
  simulação de um sistema externo de chamados: expõe funções assíncronas
  (listar/buscar/criar/atualizar/transferir/reabrir/marcar vencido), **escopadas
  pelo usuário autenticado** (privacidade do Anexo A — um funcionário nunca vê
  chamados de outro) e com **2% de falhas transitórias** para forçar tratamento
  de erro/retry. Erros são **tipados** (`TransientServiceError`,
  `TicketAccessError`, `TicketNotFoundError`, `TicketValidationError`).
- **`agent/rules.ts` são funções puras.** As decisões de negócio não dependem de
  banco, rede nem do LLM — por isso são determinísticas e cobertas por testes.
- **`agent/engine.ts` orquestra** a conversa como uma máquina de estados e produz
  mensagens com **metadados estruturados** (status line, chips, cards de
  rascunho/chamado, seletor) para a UI renderizar de forma previsível.
- **`app/` só orquestra.** As rotas autenticam, chamam o serviço/engine certo e
  devolvem JSON. Nenhuma regra de negócio mora na UI.

---

## 4. Como o agent decide o que fazer

A regra de ouro do projeto: **o LLM cuida da linguagem; o código cuida das
decisões.** Isso torna o comportamento auditável, testável e seguro (o modelo
nunca "inventa" criar um chamado ou mudar uma prioridade).

Fluxo de um turno (`agent/engine.ts`), do mais específico ao mais geral:

1. **Conversa pausada?** Se está com (ou aguardando) um analista, o agent fica
   **pausado** e apenas registra a mensagem do funcionário.
2. **Continuação de fluxo?** Se o agent está esperando os "afetados" ou a
   confirmação de um rascunho, trata essa resposta.
3. **Intenção** (`nlu.detectIntent`): pedido de analista → **transferência**;
   saudação; consulta de **status**; senão, **problema**.
4. **Escopo** (`rules.classifyScope`): RH/financeiro/facilities → **redireciona**
   educadamente.
5. **Problema de TI:**
   - **Duplicidade/reabertura** (`rules.detectDuplicate`): existe chamado aberto
     equivalente → **atualizar**; resolvido há ≤ 7 dias → **reabrir**; senão →
     **criar**.
   - **Central de ajuda** (`help-center`): se um artigo **sem ressalva** resolve,
     responde e oferece "resolveu?/abrir chamado". Artigo com ressalva de SO
     (ex.: erro 809 só no Windows 10) **não** resolve sozinho → segue para
     chamado, explicando a ressalva.
   - **Abertura:** pergunta os **afetados** (necessário para classificar),
     calcula a **prioridade** (`rules.classifyPriority`) e o **prazo**
     (`rules.computeDueAt`), mostra um **rascunho** e **só cria/atualiza após
     confirmação explícita**.
6. **Transferência** (`rules.shouldTransfer`): acontece quando o funcionário
   pede, em casos **críticos**, em chamados **vencidos**, ou quando a
   **confiança** do agent está abaixo do limiar. Leva um **resumo** ao analista
   e pausa o agent.

**Prioridade e prazo (Anexo A):**

| Prioridade | Quando | Prazo |
|-----------|--------|-------|
| Crítica | Algo parado para uma equipe/empresa inteira | 1 hora (plantão 24h) |
| Alta | Impede uma pessoa de trabalhar, ou compromisso no mesmo dia | 4h úteis |
| Média | Atrapalha mas há alternativa | 3 dias úteis |
| Baixa | Pedidos/melhorias sem urgência | 5 dias úteis |

Horário comercial: **8h–18h, seg–sex**. "Horas/dias úteis" pulam fim de semana
e fora do expediente; "crítica" usa relógio corrido (plantão). Um chamado
**vencido** passou do prazo sem atualização.

### Papel do Mastra / LLM

- O **Mastra Agent** (`agent/nexoAgent.ts`) é montado com o modelo do provedor
  configurado e com **tools** (`agent/tools.ts`) que consultam a central de
  ajuda e os chamados do usuário (escopados). Ele é usado no caminho de
  **perguntas livres** e para **redigir** respostas, respeitando o contexto
  estruturado (nunca altera ids, prioridades ou prazos).
- Sem chave de LLM, o engine usa o **texto determinístico** — por isso tudo
  roda sem configuração.

---

## 5. Como a qualidade das decisões foi validada

- **Testes automatizados (Vitest, 43 testes):**
  - `tests/rules.test.ts` — prioridade (os 4 níveis e casos de fronteira), SLA e
    aritmética de horário comercial, vencimento, duplicidade/reabertura na janela
    de 7 dias, gatilhos de transferência e escopo de TI.
  - `tests/ticket-service.test.ts` — **escopo/privacidade** (um funcionário não
    acessa chamado de outro), criação + cálculo de SLA, reabertura,
    transferência, marcação de vencido, e o comportamento de **falha transitória
    + retry** (`withRetry` retenta erro transitório e **não** retenta erro de
    negócio).
- As decisões ficam em **funções puras**, então os testes exercitam exatamente a
  lógica que roda em produção (sem mocks de LLM).
- Os **fluxos ponta a ponta** das telas 2–5 foram verificados contra as rotas de
  API (abertura com confirmação, status + transferência, reabertura, fora de
  escopo, e o takeover do analista refletindo no chamado).

Rode com `npm test`.

---

## 6. Principais trade-offs

- **Decisão determinística + LLM só para linguagem.** Escolhi tirar as decisões
  do LLM. Ganho: comportamento testável, previsível e seguro (requisito do
  desafio). Custo: a "inteligência" de interpretação do texto livre é baseada em
  palavras-chave (`nlu.ts`), menos flexível que deixar o LLM decidir. É uma troca
  consciente a favor de confiabilidade e avaliabilidade.
- **SQLite com `better-sqlite3` (síncrono) em vez de Prisma.** Menos "mágica",
  schema SQL explícito, zero passo de codegen — mais fácil de ler numa
  entrevista. Custo: sem migrations versionadas nem query builder tipado.
- **Console em _polling_ (~2,5s) em vez de WebSocket/SSE.** Simples e robusto
  para o escopo; custo: não é "tempo real" de verdade.
- **Auth por cookie assinado (HMAC), senhas em texto no seed.** Suficiente para
  o escopo e para escopar a privacidade; não é auth de produção.
- **Datas do seed relativas a "agora".** Mantêm "vencido" e "reabrível em 7 dias"
  verdadeiros em qualquer data de avaliação — por isso os rótulos absolutos podem
  divergir das capturas do protótipo.

---

## 7. O que eu faria com mais tempo

- Camada de NLU híbrida: usar o LLM para **extrair** sinais estruturados
  (afetados, urgência, categoria) com _function calling_, mantendo as **regras**
  como árbitro final.
- WebSocket/SSE para o console (presença e "digitando..." reais).
- Migrations versionadas e hashing de senha (+ provedor de identidade real).
- Varredura periódica de SLA (cron) marcando vencidos e notificando.
- Testes de integração das rotas de API e testes de UI (Playwright).
- Internacionalização e acessibilidade (foco, ARIA) mais completas.
- Observabilidade: traços do Mastra/LLM e métricas de decisão (taxa de
  transferência, confiança média).

---

## 8. Por que Google Gemini como provedor padrão

- **Camada de abstração primeiro:** o provedor é configurável por env
  (`LLM_PROVIDER`) sobre o **Vercel AI SDK**, que o Mastra consome diretamente.
  Trocar para Anthropic ou OpenAI é mudar uma variável — então a escolha do
  padrão é de **conveniência**, não de amarração.
- **Gemini** foi o padrão por: (1) ter um **tier gratuito** acessível no Google
  AI Studio, reduzindo o atrito para o avaliador obter uma chave; (2)
  `gemini-2.0-flash` ser **rápido e barato**, adequado a um assistente de chat de
  alto volume; (3) bom suporte a **tool calling** via AI SDK, que é o que o
  Mastra usa nas tools do agent.
- Para tarefas que exijam raciocínio mais forte, basta apontar `LLM_PROVIDER` e
  `LLM_MODEL` para Anthropic (ex.: `claude-sonnet-4-6`) sem mudar código.

---

## 9. Estrutura de pastas

```
src/
  app/                 páginas + rotas de API (orquestração)
  agent/               rules, nlu, engine, prompt, llm, tools, nexoAgent
  services/
    ticket-service/    chamados simulados (escopado, falhas, retry)
    help-center/       busca por palavras-chave
    conversation-service/  persistência de conversas/mensagens
    directory/         usuários/autenticação
  db/                  conexão SQLite, schema.sql, seed
  domain/              tipos e rótulos (Anexo A)
  lib/                 auth (sessão), console (tags)
  components/          EmployeeShell, ícones
tests/                 Vitest (rules + ticket-service)
data/                  banco SQLite (gerado; fora do Git)
img/                   capturas de referência do protótipo
```

---

Feito com TypeScript estrito (`strict: true`), Next.js (App Router), Mastra,
Vercel AI SDK e SQLite.
