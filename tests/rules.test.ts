import { describe, it, expect } from "vitest";
import {
  classifyPriority,
  computeDueAt,
  addBusinessHours,
  addBusinessDays,
  isBusinessMoment,
  isOverdue,
  detectDuplicate,
  shouldTransfer,
  classifyScope,
  SLA_BY_PRIORITY,
} from "@/agent/rules";

describe("classifyPriority (impacto + urgência)", () => {
  it("é CRÍTICA quando um incidente para uma equipe/empresa inteira", () => {
    expect(
      classifyPriority({ type: "INC", affected: "toda_empresa", workBlocked: true, sameDayCommitment: false }),
    ).toBe("critica");
    expect(
      classifyPriority({ type: "INC", affected: "minha_equipe", workBlocked: true, sameDayCommitment: false }),
    ).toBe("critica");
  });

  it("é ALTA quando impede uma pessoa de trabalhar", () => {
    expect(
      classifyPriority({ type: "INC", affected: "somente_eu", workBlocked: true, sameDayCommitment: false }),
    ).toBe("alta");
  });

  it("é ALTA quando há compromisso no mesmo dia (mesmo sem bloqueio total)", () => {
    expect(
      classifyPriority({ type: "INC", affected: "somente_eu", workBlocked: false, sameDayCommitment: true }),
    ).toBe("alta");
  });

  it("é MÉDIA para incidente que atrapalha mas tem alternativa", () => {
    expect(
      classifyPriority({ type: "INC", affected: "somente_eu", workBlocked: false, sameDayCommitment: false }),
    ).toBe("media");
  });

  it("é BAIXA para requisição sem urgência", () => {
    expect(
      classifyPriority({ type: "REQ", affected: "somente_eu", workBlocked: false, sameDayCommitment: false }),
    ).toBe("baixa");
  });

  it("uma equipe afetada sem bloqueio não é crítica (só impacto, sem parada)", () => {
    expect(
      classifyPriority({ type: "INC", affected: "minha_equipe", workBlocked: false, sameDayCommitment: false }),
    ).toBe("media");
  });
});

describe("SLA e prazos (horário comercial 8h-18h, seg-sex)", () => {
  it("define rótulos corretos por prioridade", () => {
    expect(SLA_BY_PRIORITY.critica.label).toBe("1 hora");
    expect(SLA_BY_PRIORITY.alta.label).toBe("4h úteis");
    expect(SLA_BY_PRIORITY.media.label).toBe("3 dias úteis");
    expect(SLA_BY_PRIORITY.baixa.label).toBe("5 dias úteis");
  });

  it("crítica usa relógio corrido (1h), inclusive fora do expediente", () => {
    // sábado 23:00 -> +1h corrida
    const sat = new Date("2026-10-24T23:00:00");
    const due = computeDueAt(sat, "critica");
    expect(due.getTime() - sat.getTime()).toBe(60 * 60 * 1000);
  });

  it("alta soma 4h ÚTEIS pulando o fim do expediente", () => {
    // quinta 16:00 -> +4h úteis: 2h hoje (até 18h) + 2h na sexta (até 10h)
    const thu = new Date("2026-10-22T16:00:00"); // quinta
    const due = addBusinessHours(thu, 4);
    expect(due.getDay()).toBe(5); // sexta
    expect(due.getHours()).toBe(10);
  });

  it("alta iniciada na sexta à tarde atravessa o fim de semana", () => {
    const fri = new Date("2026-10-23T17:00:00"); // sexta 17h
    const due = addBusinessHours(fri, 4); // 1h sexta + 3h segunda
    expect(due.getDay()).toBe(1); // segunda
    expect(due.getHours()).toBe(11);
  });

  it("média soma 3 dias úteis pulando o fim de semana", () => {
    const fri = new Date("2026-10-23T10:00:00"); // sexta
    const due = addBusinessDays(fri, 3); // seg, ter, qua
    expect(due.getDay()).toBe(3); // quarta
  });

  it("isBusinessMoment reconhece expediente e fora dele", () => {
    expect(isBusinessMoment(new Date("2026-10-22T09:00:00"))).toBe(true); // qui 9h
    expect(isBusinessMoment(new Date("2026-10-22T19:00:00"))).toBe(false); // qui 19h
    expect(isBusinessMoment(new Date("2026-10-24T10:00:00"))).toBe(false); // sábado
  });
});

describe("isOverdue (vencimento)", () => {
  const now = new Date("2026-10-26T12:00:00");
  it("vencido quando passou do prazo e não resolvido", () => {
    expect(isOverdue({ status: "open", dueAt: "2026-10-25T12:00:00" }, now)).toBe(true);
  });
  it("não vencido quando dentro do prazo", () => {
    expect(isOverdue({ status: "open", dueAt: "2026-10-27T12:00:00" }, now)).toBe(false);
  });
  it("nunca vencido quando resolvido", () => {
    expect(isOverdue({ status: "resolved", dueAt: "2026-10-01T12:00:00" }, now)).toBe(false);
  });
});

describe("detectDuplicate (sem duplicidade / reabertura em 7 dias)", () => {
  const now = new Date("2026-10-26T12:00:00");

  it("ATUALIZA quando há chamado aberto equivalente", () => {
    const res = detectDuplicate(
      { category: "Rede e VPN", text: "VPN não conecta, erro 809 no notebook" },
      [
        {
          id: "INC-1",
          category: "Rede e VPN",
          status: "in_progress",
          text: "VPN não conecta erro 809",
          resolvedAt: null,
        },
      ],
      now,
    );
    expect(res.action).toBe("update");
    expect(res.ticketId).toBe("INC-1");
  });

  it("REABRE quando há resolvido equivalente há <= 7 dias", () => {
    const res = detectDuplicate(
      { category: "Hardware", text: "A impressora do 3º andar sem conexão de novo" },
      [
        {
          id: "INC-2",
          category: "Hardware",
          status: "resolved",
          text: "Impressora do 3º andar sem conexão",
          resolvedAt: "2026-10-23T12:00:00", // 3 dias atrás
        },
      ],
      now,
    );
    expect(res.action).toBe("reopen");
    expect(res.ticketId).toBe("INC-2");
  });

  it("CRIA quando o resolvido equivalente passou de 7 dias", () => {
    const res = detectDuplicate(
      { category: "Hardware", text: "Impressora do 3º andar sem conexão" },
      [
        {
          id: "INC-3",
          category: "Hardware",
          status: "resolved",
          text: "Impressora do 3º andar sem conexão",
          resolvedAt: "2026-10-10T12:00:00", // 16 dias atrás
        },
      ],
      now,
    );
    expect(res.action).toBe("create");
  });

  it("CRIA quando não há chamado da mesma categoria", () => {
    const res = detectDuplicate(
      { category: "E-mail", text: "Outlook não envia" },
      [
        {
          id: "INC-4",
          category: "Hardware",
          status: "open",
          text: "notebook lento",
          resolvedAt: null,
        },
      ],
      now,
    );
    expect(res.action).toBe("create");
  });

  it("não considera duplicata se a categoria bate mas o assunto é diferente", () => {
    const res = detectDuplicate(
      { category: "Acesso", text: "Preciso de acesso ao SAP" },
      [
        {
          id: "INC-5",
          category: "Acesso",
          status: "open",
          text: "Liberar pasta SharePoint do Financeiro",
          resolvedAt: null,
        },
      ],
      now,
    );
    expect(res.action).toBe("create");
  });
});

describe("shouldTransfer (gatilhos de transferência)", () => {
  const base = {
    userRequested: false,
    ticketOverdue: false,
    agentConfidence: 0.9,
  };

  it("transfere quando o funcionário pede", () => {
    const d = shouldTransfer({ ...base, userRequested: true });
    expect(d.transfer).toBe(true);
    expect(d.reason).toBe("user_request");
  });

  it("transfere em caso crítico", () => {
    const d = shouldTransfer({ ...base, priority: "critica" });
    expect(d.transfer).toBe(true);
    expect(d.reason).toBe("critical");
  });

  it("transfere quando o chamado está vencido", () => {
    const d = shouldTransfer({ ...base, ticketOverdue: true });
    expect(d.transfer).toBe(true);
    expect(d.reason).toBe("overdue");
  });

  it("transfere quando a confiança está abaixo do limiar", () => {
    const d = shouldTransfer({ ...base, agentConfidence: 0.3 });
    expect(d.transfer).toBe(true);
    expect(d.reason).toBe("low_confidence");
  });

  it("NÃO transfere quando está tudo sob controle", () => {
    const d = shouldTransfer({ ...base, priority: "media" });
    expect(d.transfer).toBe(false);
    expect(d.reason).toBeNull();
  });
});

describe("classifyScope (só assuntos de TI)", () => {
  it("marca RH como fora de escopo", () => {
    expect(classifyScope("quero ver meu holerite e minhas férias").inScope).toBe(false);
    expect(classifyScope("quero ver meu holerite").area).toBe("rh");
  });
  it("marca financeiro como fora de escopo", () => {
    expect(classifyScope("preciso de um reembolso de despesa").inScope).toBe(false);
  });
  it("marca facilities como fora de escopo", () => {
    expect(classifyScope("o ar-condicionado da sala parou").inScope).toBe(false);
  });
  it("assunto de TI permanece no escopo", () => {
    expect(classifyScope("minha VPN não conecta, erro 809").inScope).toBe(true);
    expect(classifyScope("preciso instalar um software").inScope).toBe(true);
  });
});
