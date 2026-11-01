export const queryBudgetIndexes=[
 "CREATE INDEX IF NOT EXISTS messages_live_recent ON messages(conversation,sender,created DESC,id DESC) WHERE deleted=0 AND text LIKE '[[vela-live-music:1:%'",
 "CREATE INDEX IF NOT EXISTS messages_live_pinned ON messages(conversation,created DESC,id DESC) WHERE deleted=0 AND pinned=1 AND text LIKE '[[vela-live-music:1:%'",
 "CREATE INDEX IF NOT EXISTS messages_live_sender ON messages(sender,conversation,created DESC,id DESC) WHERE deleted=0 AND text LIKE '[[vela-live-music:1:%'",
 "CREATE INDEX IF NOT EXISTS calls_active_lookup ON calls(conversation,created DESC) WHERE status IN ('ringing','active')",
 'CREATE INDEX IF NOT EXISTS rate_limits_expires ON rate_limits(expires)',
 'CREATE INDEX IF NOT EXISTS blocks_target ON blocks(target,uid)'
];
const ready=new WeakSet();
export async function ensureQueryBudget(env){
 if(ready.has(env))return;
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS vela_feature_migrations(id TEXT PRIMARY KEY)').run();
 if(await env.DB.prepare("SELECT 1 FROM vela_feature_migrations WHERE id='query-budget-v2-blocks'").first()){ready.add(env);return;}
 await env.DB.batch([...queryBudgetIndexes.map(sql=>env.DB.prepare(sql)),env.DB.prepare("INSERT OR IGNORE INTO vela_feature_migrations(id) VALUES('query-budget-v2-blocks')")]);
 ready.add(env);
}
