-- ─────────────────────────────────────────────────────────────────────────
-- Nexo Assist — schema SQLite
-- Persistência local em arquivo (sobrevive a reinício). Migração idempotente.
-- ─────────────────────────────────────────────────────────────────────────

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  password             TEXT NOT NULL,            -- demo: senha da rede (texto; ver README)
  role                 TEXT NOT NULL CHECK (role IN ('employee', 'analyst')),
  department           TEXT,
  analyst_tier         TEXT,
  password_changed_at  TEXT NOT NULL,
  avatar_initials      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id                   TEXT PRIMARY KEY,         -- INC-20311 / REQ-10442
  type                 TEXT NOT NULL CHECK (type IN ('INC', 'REQ')),
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  category             TEXT NOT NULL,
  subcategory          TEXT,
  priority             TEXT NOT NULL CHECK (priority IN ('critica','alta','media','baixa')),
  affected             TEXT NOT NULL CHECK (affected IN ('somente_eu','minha_equipe','toda_empresa','nao_sei')),
  status               TEXT NOT NULL CHECK (status IN ('open','in_progress','awaiting_analyst','approved','resolved')),
  requester_id         TEXT NOT NULL REFERENCES users(id),
  assigned_analyst_id  TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  due_at               TEXT NOT NULL,
  resolved_at          TEXT,
  overdue              INTEGER NOT NULL DEFAULT 0  -- 0/1
);

CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS ticket_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id),
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  actor       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id);

CREATE TABLE IF NOT EXISTS help_articles (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  body      TEXT NOT NULL,
  category  TEXT NOT NULL,
  keywords  TEXT NOT NULL,     -- JSON array
  os_scope  TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id                   TEXT PRIMARY KEY,
  employee_id          TEXT NOT NULL REFERENCES users(id),
  status               TEXT NOT NULL CHECK (status IN ('agent','awaiting_analyst','analyst','resolved')),
  assigned_analyst_id  TEXT REFERENCES users(id),
  confidence           REAL NOT NULL DEFAULT 1.0,
  transfer_note        TEXT,
  unread_count         INTEGER NOT NULL DEFAULT 0,
  agent_state          TEXT,                       -- JSON do estado do fluxo do agent
  related_ticket_id    TEXT REFERENCES tickets(id),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_employee ON conversations(employee_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id),
  role             TEXT NOT NULL CHECK (role IN ('user','agent','analyst','system')),
  author_name      TEXT,
  content          TEXT NOT NULL,
  meta             TEXT,            -- JSON (MessageMeta) ou NULL
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- Contadores para gerar ids humanos sequenciais (INC-xxxxx / REQ-xxxxx).
CREATE TABLE IF NOT EXISTS counters (
  name   TEXT PRIMARY KEY,
  value  INTEGER NOT NULL
);
