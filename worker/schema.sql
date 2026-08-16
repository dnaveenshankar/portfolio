-- Admin auth table. Passwords are never stored in plaintext.
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,       -- hex PBKDF2 hash
  password_salt TEXT NOT NULL,       -- hex random salt
  must_change_password INTEGER NOT NULL DEFAULT 1,
  reset_token TEXT,
  reset_token_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Records admin actions (logins, edits, password changes) for the dashboard's activity feed.
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  action TEXT NOT NULL,        -- e.g. 'login', 'profile_update', 'password_change'
  detail TEXT,                 -- optional short description
  ip TEXT,
  created_at INTEGER NOT NULL
);

-- First CMS-managed content section: site profile. Other sections (skills, projects,
-- experience, etc.) follow this same pattern later — one table + one pair of API routes each.
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
  full_name TEXT,
  title TEXT,
  bio TEXT,
  location TEXT,
  email TEXT,
  avatar_url TEXT,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO profile (id, full_name, title, bio, location, email, avatar_url, updated_at)
VALUES (1, NULL, NULL, NULL, NULL, NULL, NULL, 0);

-- Skills section — same pattern as profile, but a list instead of a singleton.
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,             -- e.g. 'Frontend', 'Backend', 'DevOps'
  proficiency INTEGER,       -- 1-100, optional
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
