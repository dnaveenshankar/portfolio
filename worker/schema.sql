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

-- 'bar' = shown with a proficiency progress bar; 'chip' = plain tag (proficiency unused).
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

-- Shared card shape used by Experience, Education, and Achievements/Leadership:
-- a short card preview (meta + title + summary) and a "View Details" modal
-- (details_json: array of [label, value] pairs; bullets_json: array of strings; note: closing paragraph).
CREATE TABLE IF NOT EXISTS experience (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meta TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  details_json TEXT,
  bullets_json TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meta TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  details_json TEXT,
  bullets_json TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Covers the site's "Leadership and achievements" section.
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meta TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  details_json TEXT,
  bullets_json TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS certifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icon TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  details_json TEXT,
  bullets_json TEXT,
  note TEXT,
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

-- Configurable rotational shift definitions — editable in admin, drives both
-- the availability calendar and the "am I available right now" public status.
-- start_time/end_time are 'HH:MM' 24-hour, IST. end_next_day=1 means the shift
-- crosses midnight (e.g. Night 16:00 - 08:00 the next day).
CREATE TABLE IF NOT EXISTS shift_types (
  code TEXT PRIMARY KEY,      -- 'G','M','A','S','N','OFF'
  label TEXT NOT NULL,
  start_time TEXT,            -- NULL for OFF
  end_time TEXT,              -- NULL for OFF
  end_next_day INTEGER NOT NULL DEFAULT 0,
  is_off INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO shift_types (code, label, start_time, end_time, end_next_day, is_off, sort_order, updated_at) VALUES
  ('G', 'General', '06:00', '22:00', 0, 0, 0, 0),
  ('M', 'Morning', '05:00', '21:00', 0, 0, 1, 0),
  ('A', 'Afternoon', '10:00', '01:00', 1, 0, 2, 0),
  ('S', 'Second', '12:00', '04:00', 1, 0, 3, 0),
  ('N', 'Night', '16:00', '08:00', 1, 0, 4, 0),
  ('OFF', 'Off', NULL, NULL, 0, 1, 5, 0);

-- Rotational shift availability, date-based. shift_type references shift_types.code.
CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,         -- 'YYYY-MM-DD'
  shift_type TEXT NOT NULL,   -- references shift_types.code
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
