-- Sana booking upgrade: richer booking fields, tracking, pricing, status and email verification drafts.
CREATE TABLE IF NOT EXISTS sana_booking_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  service TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  booking_type TEXT,
  hours REAL,
  topic TEXT,
  participants INTEGER,
  preferred_date TEXT,
  preferred_time TEXT,
  timezone TEXT,
  details_json TEXT,
  price_requested INTEGER NOT NULL DEFAULT 0,
  verification_code_hash TEXT,
  verification_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE sana_bookings ADD COLUMN booking_type TEXT;
ALTER TABLE sana_bookings ADD COLUMN hours REAL;
ALTER TABLE sana_bookings ADD COLUMN topic TEXT;
ALTER TABLE sana_bookings ADD COLUMN participants INTEGER;
ALTER TABLE sana_bookings ADD COLUMN tracking_code TEXT;
ALTER TABLE sana_bookings ADD COLUMN price_requested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sana_bookings ADD COLUMN price_amount REAL;
ALTER TABLE sana_bookings ADD COLUMN price_currency TEXT DEFAULT 'INR';
ALTER TABLE sana_bookings ADD COLUMN admin_note TEXT;
ALTER TABLE sana_bookings ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sana_bookings ADD COLUMN email_verified_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sana_bookings_tracking_code ON sana_bookings(tracking_code);
CREATE INDEX IF NOT EXISTS idx_sana_booking_drafts_session ON sana_booking_drafts(session_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_sana_bookings_slot ON sana_bookings(preferred_date, preferred_time, status);
CREATE INDEX IF NOT EXISTS idx_sana_bookings_email ON sana_bookings(email);
