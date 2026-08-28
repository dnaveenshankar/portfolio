-- Sana live connection requests need a visitor name before approval.
ALTER TABLE sana_sessions ADD COLUMN connect_name TEXT;
ALTER TABLE sana_sessions ADD COLUMN connect_name_requested INTEGER NOT NULL DEFAULT 0;
