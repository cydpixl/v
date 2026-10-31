PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY,handle TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,avatar TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'online',last_seen INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friends(id TEXT PRIMARY KEY,a TEXT NOT NULL,b TEXT NOT NULL,requested_by TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,UNIQUE(a,b));
CREATE INDEX IF NOT EXISTS friends_a ON friends(a,status);
CREATE INDEX IF NOT EXISTS friends_b ON friends(b,status);
CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('direct','group')),name TEXT NOT NULL DEFAULT '',owner TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS members(conversation TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,uid TEXT NOT NULL,last_read INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(conversation,uid));
CREATE INDEX IF NOT EXISTS members_uid ON members(uid,conversation);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,sender TEXT NOT NULL,text TEXT NOT NULL DEFAULT '',attachment TEXT,reply_to TEXT,created INTEGER NOT NULL,edited INTEGER,deleted INTEGER NOT NULL DEFAULT 0,pinned INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS messages_page ON messages(conversation,created DESC,id DESC);
CREATE TABLE IF NOT EXISTS reactions(message TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,uid TEXT NOT NULL,emoji TEXT NOT NULL,PRIMARY KEY(message,uid,emoji));
CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,conversation TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,caller TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,ended INTEGER);
CREATE INDEX IF NOT EXISTS calls_conversation ON calls(conversation,created DESC);
CREATE TABLE IF NOT EXISTS blocks(uid TEXT NOT NULL,target TEXT NOT NULL,PRIMARY KEY(uid,target));
CREATE TABLE IF NOT EXISTS bookmarks(uid TEXT NOT NULL,message TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,PRIMARY KEY(uid,message));
CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL,created INTEGER NOT NULL,conversation TEXT);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS scheduled_messages(id TEXT PRIMARY KEY,conversation TEXT NOT NULL,sender TEXT NOT NULL,text TEXT NOT NULL,reply_to TEXT,deliver_at INTEGER NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS scheduled_messages_due ON scheduled_messages(deliver_at);

CREATE TABLE IF NOT EXISTS read_receipts(uid TEXT NOT NULL,conversation TEXT NOT NULL,last_read INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(uid,conversation));

CREATE TABLE IF NOT EXISTS site_admins(uid TEXT PRIMARY KEY,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS site_message_rules(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_by TEXT NOT NULL,updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS message_edit_audit(id TEXT PRIMARY KEY,message TEXT NOT NULL,admin TEXT NOT NULL,before_text TEXT NOT NULL,after_text TEXT NOT NULL,edited INTEGER NOT NULL);

CREATE INDEX IF NOT EXISTS messages_live_recent ON messages(conversation,sender,created DESC,id DESC) WHERE deleted=0 AND text LIKE '[[vela-live-music:1:%';
CREATE INDEX IF NOT EXISTS messages_live_pinned ON messages(conversation,created DESC,id DESC) WHERE deleted=0 AND pinned=1 AND text LIKE '[[vela-live-music:1:%';
CREATE INDEX IF NOT EXISTS messages_live_sender ON messages(sender,conversation,created DESC,id DESC) WHERE deleted=0 AND text LIKE '[[vela-live-music:1:%';
CREATE INDEX IF NOT EXISTS calls_active_lookup ON calls(conversation,created DESC) WHERE status IN ('ringing','active');
CREATE INDEX IF NOT EXISTS rate_limits_expires ON rate_limits(expires);
