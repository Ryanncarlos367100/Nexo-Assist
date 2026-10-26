import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getDb, ensureSeeded, closeDb } from "@/db";
import {
  listTickets,
  listTicketsByEmployee,
  getTicket,
  createTicket,
  reopenTicket,
  transferTicket,
  markOverdue,
  withRetry,
  setFailureRate,
  TransientServiceError,
  TicketAccessError,
  TicketNotFoundError,
  type AuthContext,
} from "@/services/ticket-service";

const ana: AuthContext = { userId: "u-ana", role: "employee" };
const bruno: AuthContext = { userId: "u-bruno", role: "employee" };
const rafael: AuthContext = { userId: "u-rafael", role: "analyst" };

function resetDb(): void {
  closeDb();
  const base = join(process.cwd(), process.env.DATABASE_PATH ?? "./data/test.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(base + suffix)) rmSync(base + suffix);
  }
  getDb();
  ensureSeeded();
}

beforeEach(() => {
  resetDb();
  setFailureRate(0);
});

afterAll(() => {
  closeDb();
});

describe("escopo e privacidade", () => {
  it("lista apenas os chamados do próprio funcionário", async () => {
    const tickets = await listTickets(ana);
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets.every((t) => t.requesterId === "u-ana")).toBe(true);
    expect(tickets.some((t) => t.id === "INC-20311")).toBe(true);
  });

  it("um funcionário NÃO acessa o chamado de outro (TicketAccessError)", async () => {
    // INC-20502 é do Bruno.
    await expect(getTicket(ana, "INC-20502")).rejects.toBeInstanceOf(TicketAccessError);
  });

  it("chamado inexistente lança TicketNotFoundError", async () => {
    await expect(getTicket(ana, "INC-00000")).rejects.toBeInstanceOf(TicketNotFoundError);
  });

  it("analista pode listar chamados de um funcionário; funcionário não", async () => {
    const asAnalyst = await listTicketsByEmployee(rafael, "u-ana");
    expect(asAnalyst.every((t) => t.requesterId === "u-ana")).toBe(true);
    await expect(listTicketsByEmployee(bruno, "u-ana")).rejects.toBeInstanceOf(TicketAccessError);
  });
});

describe("criação e SLA", () => {
  it("cria chamado com id sequencial, status open e prazo calculado", async () => {
    const before = await listTickets(ana);
    const created = await createTicket(ana, {
      type: "INC",
      title: "VPN não conecta",
      description: "Erro 809 ao conectar",
      category: "Rede e VPN",
      priority: "alta",
      affected: "somente_eu",
    });
    expect(created.id).toMatch(/^INC-\d+$/);
    expect(created.status).toBe("open");
    expect(created.requesterId).toBe("u-ana");
    expect(new Date(created.dueAt).getTime()).toBeGreaterThan(new Date(created.createdAt).getTime());

    const after = await listTickets(ana);
    expect(after.length).toBe(before.length + 1);
  });

  it("valida título e descrição obrigatórios", async () => {
    await expect(
      createTicket(ana, {
        type: "INC",
        title: "   ",
        description: "x",
        category: "Outros",
        priority: "baixa",
        affected: "somente_eu",
      }),
    ).rejects.toThrow();
  });
});

describe("reabertura, transferência e vencimento", () => {
  it("reabre um chamado resolvido (status volta a in_progress)", async () => {
    // INC-20455 (Ana) está resolvido no seed.
    const reopened = await reopenTicket(ana, "INC-20455");
    expect(reopened.status).toBe("in_progress");
    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.overdue).toBe(false);
  });

  it("não reabre um chamado que não está resolvido", async () => {
    await expect(reopenTicket(ana, "INC-20311")).rejects.toThrow();
  });

  it("transfere um chamado para a fila do analista", async () => {
    const t = await transferTicket(ana, "INC-20298", { analystTier: "Suporte N2" });
    expect(t.status).toBe("awaiting_analyst");
  });

  it("marca um chamado como vencido", async () => {
    const t = await markOverdue("INC-20298");
    expect(t.overdue).toBe(true);
  });
});

describe("indisponibilidade transitória + retry", () => {
  it("lança TransientServiceError quando o serviço 'cai'", async () => {
    setFailureRate(1);
    await expect(listTickets(ana)).rejects.toBeInstanceOf(TransientServiceError);
  });

  it("withRetry retenta erros transitórios (e eventualmente desiste)", async () => {
    setFailureRate(1); // sempre falha → esgota as tentativas
    await expect(
      withRetry(() => listTickets(ana), { retries: 2, delayMs: 1 }),
    ).rejects.toBeInstanceOf(TransientServiceError);
  });

  it("withRetry NÃO retenta erros de negócio (acesso negado)", async () => {
    setFailureRate(0);
    await expect(
      withRetry(() => getTicket(ana, "INC-20502"), { retries: 3, delayMs: 1 }),
    ).rejects.toBeInstanceOf(TicketAccessError);
  });

  it("withRetry tem sucesso quando a falha é intermitente", async () => {
    // Falha nas primeiras chamadas e depois estabiliza.
    let calls = 0;
    const op = async () => {
      calls += 1;
      if (calls < 3) throw new TransientServiceError();
      return "ok";
    };
    const result = await withRetry(op, { retries: 5, delayMs: 1 });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });
});
