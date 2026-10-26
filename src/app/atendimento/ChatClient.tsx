"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./chat.module.css";
import { SendIcon, CheckIcon, TransferIcon } from "@/components/icons";
import type {
  Conversation,
  Message,
  TicketCardData,
  TicketDraft,
  TicketPickerItem,
} from "@/domain/types";
import {
  PRIORITY_LABEL,
  PRIORITY_BADGE,
  STATUS_LABEL,
  STATUS_BADGE,
  AFFECTED_LABEL,
  formatDateTime,
  formatDateShort,
  formatTime,
  formatRelative,
} from "@/domain/labels";

interface ChatPayload {
  conversation: Conversation | null;
  messages: Message[];
  paused?: boolean;
}

export default function ChatClient() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const paused =
    conversation?.status === "awaiting_analyst" ||
    conversation?.status === "analyst";

  const apply = useCallback((data: ChatPayload) => {
    setConversation(data.conversation);
    setMessages(data.messages);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/chat");
    if (res.ok) apply((await res.json()) as ChatPayload);
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  // Quando pausado (com analista), faz polling para receber as respostas dele.
  useEffect(() => {
    if (!paused) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [paused, load]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  async function send(body: Record<string, unknown>) {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) apply((await res.json()) as ChatPayload);
    } finally {
      setSending(false);
    }
  }

  function sendText() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void send({ text });
  }

  const lastId = messages.length ? messages[messages.length - 1]!.id : null;
  const lastMsg = messages.length ? messages[messages.length - 1]! : null;
  const draftPending = Boolean(lastMsg?.meta?.draft) && !paused;
  const userMsgCount = messages.filter((m) => m.role === "user").length;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) sendText();
      else if (draftPending) void send({ action: "confirm" });
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.thread} ref={threadRef}>
        <div className={styles.inner}>
          {messages.map((m) => (
            <MessageView
              key={m.id}
              message={m}
              isLast={m.id === lastId}
              interactive={m.id === lastId && !paused && !sending}
              onAction={(action, value) => void send({ action, value })}
            />
          ))}
        </div>
      </div>

      <div className={styles.composer}>
        <div className={styles.composerInner}>
          {paused && (
            <div className={styles.pausedBanner}>
              <TransferIcon width={15} height={15} /> Conversa com um analista — o
              assistente está pausado. As respostas aparecem aqui.
            </div>
          )}
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              placeholder={paused ? "Aguardando o analista..." : "Escreva para o Nexo..."}
              value={input}
              disabled={paused || sending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              className="btn btn-primary"
              onClick={sendText}
              disabled={paused || sending || !input.trim()}
            >
              <SendIcon width={16} height={16} /> Enviar
            </button>
          </div>
          <div className={styles.counter}>
            {Math.min(userMsgCount, 30)}/30 mensagens nesta sessão
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Render de uma mensagem ──────────────────────────────────────────────────

function MessageView({
  message,
  isLast,
  interactive,
  onAction,
}: {
  message: Message;
  isLast: boolean;
  interactive: boolean;
  onAction: (action: string, value?: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className={styles.userRow}>
        <div className={styles.userBubble}>{message.content}</div>
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className={styles.systemLine}>
        <TransferIcon width={13} height={13} /> {message.content}
      </div>
    );
  }

  if (message.role === "analyst") {
    const [name, tier] = (message.authorName ?? "").split(" · ");
    return (
      <div className={styles.analystRow}>
        <div className={styles.analystAuthor}>
          {name}
          {tier && <span className={styles.analystTag}>{tier}</span>}
        </div>
        <div className={styles.analystBubble}>{message.content}</div>
      </div>
    );
  }

  // agent
  const meta = message.meta;
  return (
    <div className={styles.agentBlock}>
      {meta?.statusLine && (
        <div className={styles.statusLine}>
          <b>Nexo Assist</b>
          {meta.statusLine.map((s, i) => (
            <span key={i} className={styles.check}>
              · <CheckIcon /> {s}
            </span>
          ))}
        </div>
      )}
      {message.content && <div className={styles.agentBubble}>{message.content}</div>}
      {meta?.ticketPicker && (
        <TicketPicker items={meta.ticketPicker} interactive={interactive} onAction={onAction} />
      )}
      {meta?.draft && <DraftCard draft={meta.draft} interactive={interactive} onAction={onAction} />}
      {meta?.ticketCard && <TicketCard card={meta.ticketCard} />}
      {meta?.chips && (
        <div className={styles.chips}>
          {meta.chips.map((c) => (
            <button
              key={c.id}
              className={styles.chip}
              disabled={!interactive}
              onClick={() => onAction(c.action)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  interactive,
  onAction,
}: {
  draft: TicketDraft;
  interactive: boolean;
  onAction: (action: string) => void;
}) {
  return (
    <div className={styles.tcard}>
      <div className={styles.tcardBody}>
        <div className={styles.tcardHead}>
          <span className={styles.eyebrow}>
            {draft.updatesTicketId
              ? `Atualização · ${draft.updatesTicketId}`
              : "Novo chamado"}{" "}
            · Rascunho {draft.draftId}
          </span>
          <span className="badge badge-warning">
            <span className="dot" /> Aguardando confirmação
          </span>
        </div>
        <div className={styles.tcardTitle}>{draft.title}</div>
        <div className={styles.tcardDesc}>{draft.description}</div>
        <div className={styles.grid}>
          <div className={styles.gridItem}>
            <div className="k">Categoria</div>
            <div className="v">
              {draft.category}
              {draft.subcategory ? ` › ${draft.subcategory}` : ""}
            </div>
          </div>
          <div className={styles.gridItem}>
            <div className="k">Prioridade</div>
            <div className="v">
              <span className={`badge ${PRIORITY_BADGE[draft.priority]}`}>
                <span className="dot" /> {PRIORITY_LABEL[draft.priority]}
              </span>
              · resposta até {formatTime(draft.dueAt)}
            </div>
          </div>
          <div className={styles.gridItem}>
            <div className="k">Afetados</div>
            <div className="v">{AFFECTED_LABEL[draft.affected]}</div>
          </div>
        </div>
      </div>
      <div className={styles.tcardActions}>
        <button
          className="btn btn-primary"
          disabled={!interactive}
          onClick={() => onAction("confirm")}
        >
          Confirmar <span className="kbd">↵</span>
        </button>
        <button className="btn btn-outline" disabled={!interactive} onClick={() => onAction("edit")}>
          Editar
        </button>
        <button className="btn btn-ghost" disabled={!interactive} onClick={() => onAction("cancel")}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function TicketCard({ card }: { card: TicketCardData }) {
  return (
    <div className={styles.tcard}>
      <div className={styles.tcardBody}>
        <div className={styles.tcardHead}>
          <span className={styles.eyebrow}>Chamado · {card.id}</span>
          <span className={`badge ${STATUS_BADGE[card.status]}`}>
            <span className="dot" /> {STATUS_LABEL[card.status]}
          </span>
        </div>
        <div className={styles.tcardTitle}>{card.title}</div>
        <div className={styles.tcardDesc}>{card.description}</div>
        <div className={styles.grid}>
          <div className={styles.gridItem}>
            <div className="k">Categoria</div>
            <div className="v">
              {card.category}
              {card.subcategory ? ` › ${card.subcategory}` : ""}
            </div>
          </div>
          <div className={styles.gridItem}>
            <div className="k">Prioridade</div>
            <div className="v">
              <span className={`badge ${PRIORITY_BADGE[card.priority]}`}>
                <span className="dot" /> {PRIORITY_LABEL[card.priority]}
              </span>
            </div>
          </div>
          <div className={styles.gridItem}>
            <div className="k">Aberto em</div>
            <div className="v">{formatDateTime(card.createdAt)}</div>
          </div>
          <div className={styles.gridItem}>
            <div className="k">Última atualização</div>
            <div className={`v ${card.overdue ? styles.vDanger : ""}`}>
              {formatRelative(card.updatedAt)}
              {card.overdue ? " · prazo vencido" : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketPicker({
  items,
  interactive,
  onAction,
}: {
  items: TicketPickerItem[];
  interactive: boolean;
  onAction: (action: string, value?: string) => void;
}) {
  return (
    <div className={styles.picker}>
      {items.map((t) => (
        <button
          key={t.id}
          className={styles.pickerItem}
          disabled={!interactive}
          onClick={() => onAction(`select_ticket:${t.id}`, `${t.id} · ${t.title}`)}
        >
          <span className={styles.radio} />
          <span className={styles.pickerId}>{t.id}</span>
          <span className={styles.pickerTitle}>{t.title}</span>
          <span className={styles.pickerMeta}>
            <span className={`badge ${STATUS_BADGE[t.status]}`}>
              <span className="dot" /> {STATUS_LABEL[t.status]}
            </span>
            <span className={styles.pickerDate}>{formatDateShort(t.createdAt)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
