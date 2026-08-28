-- Sana conversations, visitor connection requests, bookings, and admin presence.
CREATE TABLE IF NOT EXISTS sana_sessions (
  id TEXT PRIMARY KEY,
  timezone TEXT,
  country TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sana_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  conversation_id TEXT,
  sender TEXT NOT NULL, -- 'visitor', 'sana', 'naveen'
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sana_presence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  online INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  admin_username TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sana_connect_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, expired
  conversation_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sana_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  service TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  timezone TEXT,
  details_json TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new, contacted, confirmed, cancelled
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sana_messages_conversation ON sana_messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_sana_messages_session ON sana_messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_sana_connect_requests_session ON sana_connect_requests(session_id, id);
CREATE INDEX IF NOT EXISTS idx_sana_bookings_created ON sana_bookings(created_at DESC);
