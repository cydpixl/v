CREATE TABLE IF NOT EXISTS listening_preferences(uid TEXT PRIMARY KEY,shared INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS listening_history(uid TEXT NOT NULL,id TEXT NOT NULL,title TEXT NOT NULL,artist TEXT NOT NULL,album TEXT NOT NULL,started INTEGER NOT NULL,last_seen INTEGER NOT NULL,PRIMARY KEY(uid,id));
CREATE INDEX IF NOT EXISTS listening_history_recent ON listening_history(uid,last_seen DESC,id DESC);
