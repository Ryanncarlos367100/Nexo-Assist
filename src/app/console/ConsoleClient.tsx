"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./console.module.css";
import {
  NexoLogo,
  ChatIcon,
  SearchIcon,
  MoreIcon,
  SendIcon,
  TransferIcon,
  CloseIcon,
  ChevronRight,
} from "@/components/icons";
import type { Conversation, Message, Ticket, User } from "@/domain/types";
import type { ConsoleListItem, ConsoleTag } from "@/lib/console";
import {
  STATUS_LABEL,
  PRIORITY_LABEL,
  formatTime,
  formatRelative,
} from "@/domain/labels";

interface DetailPayload {
  conversation: Conversation;
  employee: User;
  assignedAnalyst: User | null;
  messages: Message[];
  tag: ConsoleTag;
}

type Tab = "todas" | "para_voce" | "com_agent" | "minhas";

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
function clock(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  return formatRelative(iso);
}
function tagClass(kind: ConsoleTag["kind"]): string {
  const map: Record<ConsoleTag["kind"], string | undefined> = {
    transfer: styles.tagTransfer,
    help: styles.tagHelp,
    agent: styles.tagAgent,
    active: styles.tagActive,
    resolved: styles.tagResolved,
  };
  return map[kind] ?? "";
}
function statusDotColor(status: string): string {
  switch (status) {
    case "resolved":
    case "approved":
      return "var(--success)";
    case "awaiting_analyst":
      return "var(--warning)";
    case "in_progress":
      return "var(--primary)";
    default:
      return "var(--ink-3)";
  }
}

export default function ConsoleClient({ analyst }: { analyst: User }) {
  const router = useRouter();
  const [items, setItems] = useState<ConsoleListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState<Tab>("para_voce");
  const [input, setInput] = useState("");
  const [rightOpen, setRightOpen] = useState(true);
  const historyRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/console/conversations");
    if (res.ok) {
      const data = (await res.json()) as { conversations: ConsoleListItem[] };
      setItems(data.conversations);
      setSelectedId((cur) => {
        if (cur) return cur;
        const firstAwaiting = data.conversations.find((c) => c.status === "awaiting_analyst");
        return (firstAwaiting ?? data.conversations[0])?.id ?? null;
      });
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/console/conversations/${id}`);
    if (res.ok) {
      const data = (await res.json()) as DetailPayload;
      setDetail(data);
      const tRes = await fetch(`/api/console/employees/${data.employee.id}/tickets`);
      if (tRes.ok) {
        const td = (await tRes.json()) as { tickets: Ticket[] };
        setTickets(td.tickets);
      }
    }
  }, []);

  useEffect(() => {
    void loadList();
    const t = setInterval(() => void loadList(), 2500);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight });
  }, [detail?.messages.length]);

  async function op(body: Record<string, unknown>) {
    if (!selectedId) return;
    const res = await fetch(`/api/console/conversations/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) setDetail((await res.json()) as DetailPayload);
    void loadList();
  }

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void op({ op: "message", text });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const counts = {
    para_voce: items.filter((i) => i.status === "awaiting_analyst").length,
    com_agent: items.filter((i) => i.status === "agent").length,
    minhas: items.filter((i) => i.status === "analyst" && i.assignedAnalystId === analyst.id).length,
  };
  const filtered = items.filter((i) => {
    if (tab === "todas") return true;
    if (tab === "para_voce") return i.status === "awaiting_analyst";
    if (tab === "com_agent") return i.status === "agent";
    return i.status === "analyst" && i.assignedAnalystId === analyst.id;
  });

  const conv = detail?.conversation ?? null;
  const assumedByMe = conv?.status === "analyst" && conv.assignedAnalystId === analyst.id;
  const relatedTicket = detail
    ? tickets.find((t) => t.id === detail.conversation.relatedTicketId) ?? null
    : null;
  const openCount = tickets.filter((t) => t.status !== "resolved").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div
      className={styles.shell}
      style={rightOpen && detail ? undefined : { gridTemplateColumns: "64px 380px 1fr" }}
    >
      {/* Rail */}
      <div className={styles.rail}>
        <div className={styles.railIcon}>
          <NexoLogo size={22} />
        </div>
        <div className={`${styles.railIcon} ${styles.railIconActive}`}>
          <ChatIcon width={19} height={19} />
          {counts.para_voce > 0 && <span className={styles.railBadge}>{counts.para_voce}</span>}
        </div>
        <div className={styles.railSpacer} />
        <div className={styles.railAvatar} onClick={logout} title={`${analyst.name} — sair`}>
          {analyst.avatarInitials}
          <span className={styles.presence} />
        </div>
      </div>

      {/* Lista */}
      <div className={styles.list}>
        <div className={styles.listHead}>
          <div className={styles.listTitle}>Conversas</div>
          <span className={styles.available}>
            <span className="dot" /> Disponível
          </span>
        </div>
        <div className={styles.searchBox}>
          <SearchIcon width={15} height={15} />
          <input placeholder="Pesquisar conversa ou chamado" />
        </div>
        <div className={styles.tabs}>
          <TabBtn label="Todas" active={tab === "todas"} onClick={() => setTab("todas")} />
          <TabBtn label="Para você" count={counts.para_voce} active={tab === "para_voce"} onClick={() => setTab("para_voce")} />
          <TabBtn label="Com o agent" count={counts.com_agent} active={tab === "com_agent"} onClick={() => setTab("com_agent")} />
          <TabBtn label="Minhas" count={counts.minhas} active={tab === "minhas"} onClick={() => setTab("minhas")} />
        </div>
        <div className={styles.items}>
          {filtered.map((it) => (
            <ListItem
              key={it.id}
              item={it}
              active={it.id === selectedId}
              onClick={() => setSelectedId(it.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 20, color: "var(--ink-3)", fontSize: 13 }}>
              Nenhuma conversa nesta aba.
            </div>
          )}
        </div>
      </div>

      {/* Painel central */}
      <div className={styles.center}>
        {!detail ? (
          <div className={styles.empty}>Selecione uma conversa</div>
        ) : (
          <>
            <div className={styles.cHeader}>
              <div className={styles.itemAvatar}>{detail.employee.avatarInitials}</div>
              <div className={styles.cHeaderInfo}>
                <div className={styles.cHeaderName}>{detail.employee.name}</div>
                <div className={styles.cHeaderSub}>
                  online
                  {detail.employee.department ? ` · ${detail.employee.department}` : ""}
                  {conv?.relatedTicketId ? ` · ${conv.relatedTicketId}` : ""}
                </div>
              </div>
              <div className={styles.cHeaderActions}>
                {assumedByMe ? (
                  <>
                    <button className="btn btn-outline" onClick={() => void op({ op: "release" })}>
                      Devolver ao agent
                    </button>
                    <button className="btn btn-danger" onClick={() => void op({ op: "close" })}>
                      Encerrar atendimento
                    </button>
                  </>
                ) : conv?.status === "awaiting_analyst" ? (
                  <span className="badge badge-warning">
                    <span className="dot" /> Aguardando atendente
                  </span>
                ) : null}
                <button className={styles.iconBtn}><SearchIcon width={17} height={17} /></button>
                <button className={styles.iconBtn}><MoreIcon width={17} height={17} /></button>
                {!rightOpen && (
                  <button className={styles.iconBtn} onClick={() => setRightOpen(true)} title="Ver chamados">
                    <ChevronRight width={17} height={17} />
                  </button>
                )}
              </div>
            </div>

            <div className={styles.history} ref={historyRef}>
              <div className={styles.dayDivider}>Hoje</div>
              {detail.messages.map((m) => (
                <ConsoleMessage key={m.id} message={m} />
              ))}
            </div>

            <Footer
              conv={conv!}
              employeeName={detail.employee.name}
              assignedAnalyst={detail.assignedAnalyst}
              assumedByMe={assumedByMe}
              analystId={analyst.id}
              input={input}
              setInput={setInput}
              onAssume={() => void op({ op: "assume" })}
              onSend={sendMessage}
            />
          </>
        )}
      </div>

      {/* Painel direito */}
      {rightOpen && detail && (
        <div className={styles.right}>
          <div className={styles.rightHead}>
            <div>
              <div className={styles.rightTitle}>Chamados da {firstName(detail.employee.name)}</div>
              <div className={styles.rightSub}>
                {openCount} abertos · {resolvedCount} encerrados
              </div>
            </div>
            <button className={styles.iconBtn} onClick={() => setRightOpen(false)}>
              <CloseIcon width={16} height={16} />
            </button>
          </div>
          <div className={styles.rightBody}>
            {relatedTicket && (
              <>
                <div className={styles.rightSection}>Desta conversa</div>
                <div className={styles.miniCard}>
                  <div className={styles.miniHead}>
                    <span className={styles.miniId}>{relatedTicket.id}</span>
                    <span className={`badge badge-${badgeKind(relatedTicket.status)}`}>
                      <span className="dot" /> {STATUS_LABEL[relatedTicket.status]}
                    </span>
                  </div>
                  <div className={styles.miniTitle}>{relatedTicket.title}</div>
                  <div className={styles.miniMeta}>
                    {relatedTicket.category} · prioridade {PRIORITY_LABEL[relatedTicket.priority].toLowerCase()}
                  </div>
                  {assumedByMe && (
                    <div className={styles.miniLog}>
                      <TransferIcon width={13} height={13} /> Assumido por {analyst.name}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className={styles.rightSection}>Outros chamados</div>
            {tickets
              .filter((t) => t.id !== relatedTicket?.id)
              .map((t) => (
                <div key={t.id} className={styles.otherItem}>
                  <span className={styles.otherDot} style={{ background: statusDotColor(t.status) }} />
                  <div className={styles.otherBody}>
                    <div className={styles.otherTitle}>{t.title}</div>
                    <div className={styles.otherMeta}>
                      {t.id} · {STATUS_LABEL[t.status]}
                    </div>
                  </div>
                  <ChevronRight width={15} height={15} />
                </div>
              ))}
          </div>
          <div className={styles.rightFooter}>
            <a href="#">Ver todos os chamados da {firstName(detail.employee.name)} ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}

function badgeKind(status: string): string {
  if (status === "resolved" || status === "approved") return "success";
  if (status === "awaiting_analyst") return "warning";
  if (status === "in_progress") return "progress";
  return "neutral";
}

function TabBtn({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`${styles.tab} ${active ? styles.tabActive : ""}`} onClick={onClick}>
      {label}
      {count !== undefined && count > 0 && <span className={styles.tabCount}>{count}</span>}
    </button>
  );
}

function ListItem({ item, active, onClick }: { item: ConsoleListItem; active: boolean; onClick: () => void }) {
  const preview = item.lastMessage
    ? (item.lastMessage.role === "agent" ? "Nexo: " : item.lastMessage.role === "analyst" ? "Você: " : "") +
      item.lastMessage.content
    : "—";
  return (
    <button className={`${styles.item} ${active ? styles.itemActive : ""}`} onClick={onClick}>
      <div className={styles.itemAvatar}>
        {item.employee.initials}
        <span
          className={styles.itemPresence}
          style={{ background: item.status === "resolved" ? "var(--ink-3)" : "var(--success)" }}
        />
      </div>
      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          <span className={styles.itemName}>{item.employee.name}</span>
          <span className={styles.itemTime}>{item.lastMessage ? clock(item.lastMessage.createdAt) : clock(item.updatedAt)}</span>
        </div>
        <div className={styles.itemPreview}>{preview}</div>
        <div className={styles.itemBottom}>
          <span className={`${styles.itemTag} ${tagClass(item.tag.kind)}`}>
            {(item.tag.kind === "transfer") && <TransferIcon width={12} height={12} />}
            {item.tag.kind !== "transfer" && <span className="dot" />}
            {item.tag.label}
          </span>
          {item.unreadCount > 0 && <span className={styles.unread}>{item.unreadCount}</span>}
        </div>
      </div>
    </button>
  );
}

function ConsoleMessage({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <div className={styles.sysLine}>
        <TransferIcon width={13} height={13} /> {message.content} · {formatTime(message.createdAt)}
      </div>
    );
  }
  if (message.role === "user") {
    return (
      <div className={styles.rowLeft}>
        <div>
          <div className={styles.bubbleEmp}>{message.content}</div>
          <div className={styles.bubbleTime}>{formatTime(message.createdAt)}</div>
        </div>
      </div>
    );
  }
  if (message.role === "analyst") {
    const [name, tier] = (message.authorName ?? "").split(" · ");
    return (
      <div className={styles.rowRight}>
        <div className={styles.rightMeta}>
          {name} <span className={styles.n2Tag}>{tier ?? "Analista"}</span>
        </div>
        <div className={styles.bubbleAnalyst}>{message.content}</div>
        <div className={styles.bubbleTime}>{formatTime(message.createdAt)}</div>
      </div>
    );
  }
  // agent
  return (
    <div className={styles.rowRight}>
      <div className={styles.rightMeta}>
        Nexo Assist <span className={styles.iaTag}>IA</span>
      </div>
      <div className={styles.bubbleAgent}>{message.content}</div>
      <div className={styles.bubbleTime}>{formatTime(message.createdAt)}</div>
    </div>
  );
}

function Footer({
  conv,
  employeeName,
  assignedAnalyst,
  assumedByMe,
  analystId,
  input,
  setInput,
  onAssume,
  onSend,
}: {
  conv: Conversation;
  employeeName: string;
  assignedAnalyst: User | null;
  assumedByMe: boolean;
  analystId: string;
  input: string;
  setInput: (v: string) => void;
  onAssume: () => void;
  onSend: () => void;
}) {
  if (assumedByMe) {
    return (
      <div className={styles.composer}>
        <input
          className={styles.composerInput}
          placeholder="Escreva sua resposta..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
        />
        <button className={styles.sendCircle} onClick={onSend} disabled={!input.trim()}>
          <SendIcon width={18} height={18} />
        </button>
      </div>
    );
  }

  if (conv.status === "analyst" && conv.assignedAnalystId !== analystId) {
    return (
      <>
        <div className={styles.takeover}>
          <span className={styles.takeoverIcon}><TransferIcon width={18} height={18} /></span>
          <div className={styles.takeoverText}>
            <div className={styles.takeoverTitle}>
              Em atendimento por {assignedAnalyst?.name ?? "outro analista"}
            </div>
          </div>
        </div>
        <div className={styles.composer}>
          <input className={styles.composerInput} placeholder="Conversa com outro analista" disabled />
          <button className={styles.sendCircle} disabled><SendIcon width={18} height={18} /></button>
        </div>
      </>
    );
  }

  if (conv.status === "resolved") {
    return (
      <div className={styles.composer}>
        <input className={styles.composerInput} placeholder="Atendimento encerrado" disabled />
        <button className={styles.sendCircle} disabled><SendIcon width={18} height={18} /></button>
      </div>
    );
  }

  // awaiting_analyst ou agent → barra de takeover
  const deadline = new Date(new Date(conv.updatedAt).getTime() + 2 * 60 * 60 * 1000);
  const waiting = conv.status === "awaiting_analyst";
  return (
    <>
      <div className={styles.takeover}>
        <span className={styles.takeoverIcon}><TransferIcon width={18} height={18} /></span>
        <div className={styles.takeoverText}>
          <div className={styles.takeoverTitle}>
            {waiting ? `${firstName(employeeName)} espera um atendente` : "Agent atendendo"}
          </div>
          <div className={styles.takeoverSub}>
            Agent pausado · até {formatTime(deadline.toISOString())}
          </div>
        </div>
        <button className="btn btn-outline" disabled>Devolver ao agent</button>
        <button className="btn btn-primary" onClick={onAssume}>Assumir atendimento</button>
      </div>
      <div className={styles.composer}>
        <input className={styles.composerInput} placeholder="Assuma o atendimento para responder" disabled />
        <button className={styles.sendCircle} disabled><SendIcon width={18} height={18} /></button>
      </div>
    </>
  );
}
