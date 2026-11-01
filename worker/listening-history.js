export const listeningSchema=[
 'CREATE TABLE IF NOT EXISTS listening_preferences(uid TEXT PRIMARY KEY,shared INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS listening_history(uid TEXT NOT NULL,id TEXT NOT NULL,title TEXT NOT NULL,artist TEXT NOT NULL,album TEXT NOT NULL,started INTEGER NOT NULL,last_seen INTEGER NOT NULL,PRIMARY KEY(uid,id))',
 'CREATE INDEX IF NOT EXISTS listening_history_recent ON listening_history(uid,last_seen DESC,id DESC)'
];
const ready=new WeakSet();
async function ensure(env){if(ready.has(env))return;await env.DB.batch(listeningSchema.map(sql=>env.DB.prepare(sql)));ready.add(env);}
export async function listeningHistoryAPI(req,env,uid,{json,body,fail,rows,row}){
 const url=new URL(req.url);if(url.pathname!=='/api/listening-history')return null;
 await ensure(env);const now=Date.now(),week=now-7*86400000;
 if(req.method==='GET'){
  const scope=url.searchParams.get('scope')==='friends'?'friends':'mine';
  const before=Math.min(now+1,Number(url.searchParams.get('before'))||now+1),beforeId=url.searchParams.get('cursor')||'\uffff';
  let users=[uid];
  if(scope==='friends')users=(await rows(env,"SELECT CASE WHEN f.a=?1 THEN f.b ELSE f.a END AS uid FROM friends f JOIN listening_preferences p ON p.uid=CASE WHEN f.a=?1 THEN f.b ELSE f.a END AND p.shared=1 WHERE f.status='accepted' AND (f.a=?1 OR f.b=?1) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.uid=?1 AND b.target=p.uid) OR (b.target=?1 AND b.uid=p.uid)) LIMIT 100",uid)).map(r=>r.uid);
  const sharing=!!(await row(env,'SELECT shared FROM listening_preferences WHERE uid=?',uid))?.shared;
  if(!users.length)return json({items:[],more:false,sharing});
  // Each person's indexed recent history is capped before merging, so a busy
  // account never forces a scan of another account's full listening history.
  const pages=await env.DB.batch(users.map(owner=>env.DB.prepare('SELECT h.*,u.name,u.avatar FROM listening_history h JOIN users u ON u.uid=h.uid WHERE h.uid=? AND h.last_seen>=? AND (h.last_seen<? OR (h.last_seen=? AND h.id<?)) ORDER BY h.last_seen DESC,h.id DESC LIMIT 51').bind(owner,week,before,before,beforeId)));
  const items=pages.flatMap(page=>page.results||[]).sort((a,b)=>b.last_seen-a.last_seen||b.id.localeCompare(a.id));
  return json({items:items.slice(0,50),more:items.length>50,sharing});
 }
 if(req.method==='POST'){
  const data=await body(req);if(typeof data.shared!=='boolean')fail('Choose a sharing preference.');
  const statements=[env.DB.prepare('INSERT INTO listening_preferences(uid,shared) VALUES(?,?) ON CONFLICT(uid) '+(data.track?'DO NOTHING':'DO UPDATE SET shared=excluded.shared')).bind(uid,data.shared?1:0)];
  if(data.track){
   const track=data.track;if(!/^[a-f0-9-]{36}$/i.test(track.id||'')||typeof track.title!=='string'||!track.title.trim()||track.title.length>200||typeof track.artist!=='string'||track.artist.length>200||typeof track.album!=='string'||track.album.length>200)fail('Invalid listening activity.');
   statements.push(env.DB.prepare('INSERT INTO listening_history(uid,id,title,artist,album,started,last_seen) VALUES(?,?,?,?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET last_seen=excluded.last_seen WHERE listening_history.title=excluded.title AND listening_history.artist=excluded.artist AND listening_history.last_seen<?').bind(uid,track.id,track.title.trim(),track.artist,track.album,now,now,now-45000));
  }
  await env.DB.batch(statements);return json({ok:true});
 }
 if(req.method==='DELETE'){
  const statements=[env.DB.prepare('DELETE FROM listening_history WHERE uid=?').bind(uid)];
  await env.DB.batch(statements);return json({ok:true});
 }
 fail('Method not allowed.',405);
}
