CREATE INDEX IF NOT EXISTS messages_live_recent ON messages(conversation,sender,created DESC,id DESC) WHERE deleted=0 AND text LIKE '[[vela-live-music:1:%';
CREATE INDEX IF NOT EXISTS messages_live_pinned ON messages(conversation,created DESC,id DESC) WHERE deleted=0 AND pinned=1 AND text LIKE '[[vela-live-music:1:%';
CREATE INDEX IF NOT EXISTS messages_live_sender ON messages(sender,conversation,created DESC,id DESC) WHERE deleted=0 AND text LIKE '[[vela-live-music:1:%';
CREATE INDEX IF NOT EXISTS calls_active_lookup ON calls(conversation,created DESC) WHERE status IN ('ringing','active');
CREATE INDEX IF NOT EXISTS rate_limits_expires ON rate_limits(expires);
