-- Sana live-chat visitor identity and indexes.
ALTER TABLE sana_connect_requests ADD COLUMN visitor_name TEXT;
CREATE INDEX IF NOT EXISTS idx_sana_connect_requests_status ON sana_connect_requests(status, expires_at, created_at);
