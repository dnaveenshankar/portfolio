-- Adds the configurable shift-hours table. Safe to run on the existing DB —
-- CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE won't touch anything else.
CREATE TABLE IF NOT EXISTS shift_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
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
