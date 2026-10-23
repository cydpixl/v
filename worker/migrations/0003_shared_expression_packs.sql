CREATE TABLE IF NOT EXISTS expression_packs(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1))
);
CREATE INDEX IF NOT EXISTS expressions_pack ON expressions(pack,created DESC);
