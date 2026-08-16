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
