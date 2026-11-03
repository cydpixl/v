CREATE TABLE IF NOT EXISTS music_playlists(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT "",created INTEGER NOT NULL,updated INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS music_playlists_owner ON music_playlists(owner);
CREATE TABLE IF NOT EXISTS music_playlist_members(playlist TEXT NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,uid TEXT NOT NULL,PRIMARY KEY(playlist,uid));
CREATE INDEX IF NOT EXISTS music_playlist_member_uid ON music_playlist_members(uid,playlist);
CREATE TABLE IF NOT EXISTS music_playlist_tracks(playlist TEXT NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL,added_by TEXT NOT NULL,added INTEGER NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(playlist,id));
