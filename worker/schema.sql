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
  category TEXT,
  proficiency INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS experience (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution TEXT NOT NULL,
  degree TEXT,
  field TEXT,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  repo_url TEXT,
  tech_stack TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS certifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  issuer TEXT,
  issue_date TEXT,
  credential_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workshops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  role TEXT,
  organizer TEXT,
  date TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT,
  company TEXT,
  quote TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS social_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Daily quote: optionally scheduled to a specific date, otherwise shown when active.
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  author TEXT,
  scheduled_date TEXT,        -- 'YYYY-MM-DD', optional
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Rotational shift availability, date-based.
CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,         -- 'YYYY-MM-DD'
  shift_type TEXT NOT NULL,   -- 'Morning' | 'Evening' | 'Night' | 'Off'
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
