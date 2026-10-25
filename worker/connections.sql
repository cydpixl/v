CREATE TABLE IF NOT EXISTS account_options(uid TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS profile_extras(uid TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS conversation_options(uid TEXT NOT NULL, conversation TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', PRIMARY KEY(uid,conversation));
CREATE TABLE IF NOT EXISTS hidden_messages(uid TEXT NOT NULL, message TEXT NOT NULL, PRIMARY KEY(uid,message));
CREATE TABLE IF NOT EXISTS group_admins(conversation TEXT NOT NULL, uid TEXT NOT NULL, PRIMARY KEY(conversation,uid));
CREATE TABLE IF NOT EXISTS chat_uploads(id TEXT PRIMARY KEY, uid TEXT NOT NULL, conversation TEXT NOT NULL, upload_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chat_upload_parts(upload TEXT NOT NULL, n INTEGER NOT NULL, etag TEXT NOT NULL, PRIMARY KEY(upload,n));
CREATE TABLE IF NOT EXISTS movie_watched(uid TEXT NOT NULL, id TEXT NOT NULL, watched INTEGER NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(uid,id));
CREATE TABLE IF NOT EXISTS movie_captions(id TEXT PRIMARY KEY, movie TEXT NOT NULL, owner TEXT NOT NULL, label TEXT NOT NULL, language TEXT NOT NULL, vtt TEXT NOT NULL, created INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS movie_watch_time(uid TEXT NOT NULL,id TEXT NOT NULL,seconds REAL NOT NULL DEFAULT 0,PRIMARY KEY(uid,id));
CREATE TABLE IF NOT EXISTS vela_feature_migrations(id TEXT PRIMARY KEY);
INSERT OR IGNORE INTO movie_watched(uid,id,watched,updated) SELECT uid,id,1,updated FROM movie_progress WHERE duration>0 AND position>=duration-30 AND NOT EXISTS(SELECT 1 FROM vela_feature_migrations WHERE id='connections-watched-v1');
INSERT OR IGNORE INTO vela_feature_migrations(id) VALUES('connections-watched-v1');
