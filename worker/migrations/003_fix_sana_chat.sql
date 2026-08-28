-- Sana chat compatibility fix.
-- The existing schema defines skills, and the public Sana endpoint reads it.
-- The production database was missing this table, which caused /public/chat to return 500.

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  proficiency INTEGER,
  display_type TEXT NOT NULL DEFAULT 'bar',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
