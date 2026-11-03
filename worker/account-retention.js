export const INACTIVITY_MS=3*86400000;
// These identities survive both the requested one-time cleanup and future inactivity runs.
export const protectedUIDs=['zPZPMqLM7uWGiudD6AiKBIUbfA72','f2UFJ9IlNYP2PAo5Yp0VGr6EdDD3'];
export function cleanupStatements(uid,now,reason='inactive'){
 if(protectedUIDs.includes(uid))return [];
 const list=[],add=(sql,...args)=>list.push({sql,args});
 add('INSERT OR IGNORE INTO deleted_accounts(uid,deleted,reason) VALUES(?,?,?)',uid,now,reason);
 add('INSERT OR IGNORE INTO account_file_cleanup(object_key) SELECT id FROM uploads WHERE owner=?',uid);
 add("INSERT OR IGNORE INTO account_file_cleanup(object_key) SELECT object_key FROM movies WHERE owner=? AND object_key<>''",uid);
 add("INSERT OR IGNORE INTO account_file_cleanup(object_key) SELECT 'expression/'||id FROM expressions WHERE owner=?",uid);
 add('DELETE FROM bookmarks WHERE message IN (SELECT id FROM messages WHERE sender=?)',uid);
 add('DELETE FROM reactions WHERE message IN (SELECT id FROM messages WHERE sender=?)',uid);
 add('DELETE FROM hidden_messages WHERE message IN (SELECT id FROM messages WHERE sender=?)',uid);
 add('DELETE FROM messages WHERE sender=?',uid);
 add("DELETE FROM conversations WHERE kind='direct' AND id IN (SELECT conversation FROM members WHERE uid=?)",uid);
 add('UPDATE conversations SET owner=COALESCE((SELECT uid FROM members WHERE conversation=conversations.id AND uid<>? LIMIT 1),owner) WHERE owner=?',uid,uid);
 add('DELETE FROM movie_captions WHERE owner=? OR movie IN (SELECT id FROM movies WHERE owner=?)',uid,uid);
 for(const table of ['movie_lists','movie_progress','movie_watched','movie_watch_time'])add('DELETE FROM '+table+' WHERE id IN (SELECT id FROM movies WHERE owner=?)',uid);
 add('DELETE FROM movies WHERE owner=?',uid);add('DELETE FROM expressions WHERE owner=?',uid);add('DELETE FROM uploads WHERE owner=?',uid);
 for(const table of ['profiles','game_collections','members','server_members','bookmarks','reactions','account_options','profile_extras','conversation_options','hidden_messages','group_admins','movie_lists','movie_progress','movie_watched','movie_watch_time','expression_favorites','listening_preferences','listening_history','read_receipts','site_admins'])add('DELETE FROM '+table+' WHERE uid=?',uid);
 add('DELETE FROM friends WHERE a=? OR b=?',uid,uid);add('DELETE FROM blocks WHERE uid=? OR target=?',uid,uid);add('DELETE FROM scheduled_messages WHERE sender=?',uid);add('DELETE FROM server_members WHERE server IN (SELECT id FROM servers WHERE owner=?)',uid);add('DELETE FROM servers WHERE owner=?',uid);add('DELETE FROM conversations WHERE NOT EXISTS(SELECT 1 FROM members WHERE conversation=conversations.id)');
 add('DELETE FROM users WHERE uid=? AND uid NOT IN (SELECT uid FROM protected_accounts)',uid);return list;
}
export async function cleanupAccounts(env,{now=Date.now(),reset=false}={}){
 const result=await env.DB.prepare('SELECT uid FROM users WHERE uid NOT IN (SELECT uid FROM protected_accounts) AND '+(reset?'1=1':'MAX(last_seen,created)<=?')+' LIMIT 25').bind(...(reset?[]:[now-INACTIVITY_MS])).all();
 let removed=0;for(const {uid}of result.results){if(protectedUIDs.includes(uid))continue;const protectedRow=await env.DB.prepare('SELECT 1 FROM protected_accounts WHERE uid=?').bind(uid).first();if(protectedRow)continue;await env.DB.batch(cleanupStatements(uid,now,reset?'requested-v2-reset':'inactive-three-days').map(({sql,args})=>env.DB.prepare(sql).bind(...args)));removed++;}
 const pending=await env.DB.prepare('SELECT object_key FROM account_file_cleanup LIMIT 100').all();for(const {object_key}of pending.results){try{await env.FILES.delete(object_key);await env.DB.prepare('DELETE FROM account_file_cleanup WHERE object_key=?').bind(object_key).run()}catch(error){console.error(JSON.stringify({event:'account-file-cleanup',message:error.message}))}}
 console.log(JSON.stringify({event:'account-retention',removed,reset}));return removed;
}
