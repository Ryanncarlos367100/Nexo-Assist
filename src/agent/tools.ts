/**
 * Tools do agent (Mastra) que dão acesso aos serviços de chamados e central de
 * ajuda. São construídas por requisição, em closure sobre o contexto de
 * autenticação, garantindo que toda consulta de chamado fique escopada ao
 * usuário logado (privacidade). Usadas pelo Mastra Agent no fluxo de perguntas
 * livres; os fluxos estruturados chamam os serviços diretamente via engine.ts.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  listTickets,
  getTicket,
  withRetry,
  type AuthContext,
  TicketAccessError,
  TicketNotFoundError,
} from "@/services/ticket-service";
import { searchArticles } from "@/services/help-center";

export function buildTools(ctx: AuthContext) {
  const searchHelpCenter = createTool({
    id: "search-help-center",
    description:
      "Busca artigos na central de ajuda de TI por palavras-chave. Use antes de abrir um chamado para tentar resolver a dúvida. Preste atenção ao campo osScope (uma solução pode valer só para uma versão de SO).",
    inputSchema: z.object({
      query: z.string().describe("Termos da busca em linguagem natural."),
    }),
    outputSchema: z.object({
      articles: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          body: z.string(),
          category: z.string(),
          osScope: z.string().nullable(),
        }),
      ),
    }),
    execute: async ({ context }) => {
      const hits = searchArticles(context.query, { limit: 3 });
      return {
        articles: hits.map((h) => ({
          id: h.article.id,
          title: h.article.title,
          body: h.article.body,
          category: h.article.category,
          osScope: h.article.osScope,
        })),
      };
    },
  });

  const listMyTickets = createTool({
    id: "list-my-tickets",
    description:
      "Lista os chamados do funcionário autenticado (apenas os dele — privacidade).",
    inputSchema: z.object({}),
    outputSchema: z.object({
      tickets: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          status: z.string(),
          priority: z.string(),
          category: z.string(),
          dueAt: z.string(),
          overdue: z.boolean(),
        }),
      ),
    }),
    execute: async () => {
      const tickets = await withRetry(() => listTickets(ctx));
      return {
        tickets: tickets.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          dueAt: t.dueAt,
          overdue: t.overdue,
        })),
      };
    },
  });

  const getMyTicket = createTool({
    id: "get-my-ticket",
    description:
      "Busca detalhes de um chamado específico do funcionário autenticado, pelo id (ex: INC-20311).",
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({
      found: z.boolean(),
      ticket: z
        .object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          status: z.string(),
          priority: z.string(),
          category: z.string(),
          dueAt: z.string(),
          overdue: z.boolean(),
        })
        .nullable(),
    }),
    execute: async ({ context }) => {
      try {
        const t = await withRetry(() => getTicket(ctx, context.id));
        return {
          found: true,
          ticket: {
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            category: t.category,
            dueAt: t.dueAt,
            overdue: t.overdue,
          },
        };
      } catch (err) {
        if (err instanceof TicketNotFoundError || err instanceof TicketAccessError) {
          return { found: false, ticket: null };
        }
        throw err;
      }
    },
  });

  return { searchHelpCenter, listMyTickets, getMyTicket };
}
