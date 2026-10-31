CREATE TABLE IF NOT EXISTS read_receipts (
 uid TEXT NOT NULL,
 conversation TEXT NOT NULL,
 last_read INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(uid,conversation)
);
