-- Additive Cinema migration. Does not alter accounts, messages, or preferences.
CREATE TABLE IF NOT EXISTS cinema_rooms(conversation TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cinema_progress(uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL,position REAL NOT NULL,duration REAL NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(uid,id));
CREATE INDEX IF NOT EXISTS cinema_progress_recent ON cinema_progress(uid,updated DESC);
