CREATE TABLE IF NOT EXISTS scheduled_messages(id TEXT PRIMARY KEY,conversation TEXT NOT NULL,sender TEXT NOT NULL,text TEXT NOT NULL,reply_to TEXT,deliver_at INTEGER NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS scheduled_messages_due ON scheduled_messages(deliver_at);
