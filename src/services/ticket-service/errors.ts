/**
 * Erros do ticket-service. Tipados para que o agent/UI tratem cada caso de
 * forma explícita (ex: retry em erro transitório, mensagem de privacidade em
 * acesso negado).
 */

/** Indisponibilidade/timeout temporário — a operação pode ser retentada. */
export class TransientServiceError extends Error {
  readonly transient = true;
  constructor(message = "Serviço de chamados temporariamente indisponível.") {
    super(message);
    this.name = "TransientServiceError";
  }
}

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Chamado ${id} não encontrado.`);
    this.name = "TicketNotFoundError";
  }
}

/** Tentativa de acessar um chamado de outro funcionário (privacidade). */
export class TicketAccessError extends Error {
  constructor() {
    super("Você não tem acesso a este chamado.");
    this.name = "TicketAccessError";
  }
}

export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketValidationError";
  }
}

export function isTransient(err: unknown): err is TransientServiceError {
  return err instanceof TransientServiceError;
}
