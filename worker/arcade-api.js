import {MULTIPLAYER_GAMES} from '../src/games/arcade-model.mjs';
const ready=new WeakSet();
export async function arcadeAPI(req,env,uid,{row,rows,body,json,fail,issueTicket,notify,ctx}){
 const path=new URL(req.url).pathname,match=path.match(/^\/api\/arcade-rooms(?:\/([a-f0-9-]{36})(\/socket)?)?$/);if(!match)return null;
 if(!ready.has(env)){await env.DB.prepare('CREATE TABLE IF NOT EXISTS desktop_arcade_rooms(id TEXT PRIMARY KEY,game TEXT NOT NULL,host TEXT NOT NULL,guest TEXT NOT NULL,created INTEGER NOT NULL)').run();await env.DB.prepare('CREATE INDEX IF NOT EXISTS desktop_arcade_members ON desktop_arcade_rooms(host,guest,created)').run();ready.add(env)}
 const friend=async(a,b)=>a!==b&&!!await row(env,`SELECT 1 FROM friends WHERE status='accepted' AND ((a=? AND b=?) OR (a=? AND b=?)) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (uid=? AND target=?) OR (target=? AND uid=?))`,a,b,b,a,a,b,a,b);
 const id=match[1];
 if(!id){
  if(req.method==='GET'){const found=await rows(env,'SELECT r.*,h.name AS host_name,g.name AS guest_name,h.avatar AS host_avatar,g.avatar AS guest_avatar FROM desktop_arcade_rooms r JOIN users h ON h.uid=r.host JOIN users g ON g.uid=r.guest WHERE (host=? OR guest=?) AND r.created>? ORDER BY created DESC LIMIT 30',uid,uid,Date.now()-86400000);const items=[];for(const room of found)if(await friend(room.host,room.guest))items.push(room);return json({items})}
  if(req.method!=='POST')fail('Method not allowed.',405);
  const data=await body(req);if(!MULTIPLAYER_GAMES.includes(data.game)||typeof data.guest!=='string'||!await friend(uid,data.guest))fail('Choose a game and an accepted friend.',403);
  const count=await row(env,'SELECT COUNT(*) AS n FROM desktop_arcade_rooms WHERE host=? AND created>?',uid,Date.now()-86400000);if(count.n>=20)fail('Close an old room before creating another.');
  const id=crypto.randomUUID(),players=await rows(env,'SELECT uid,name,avatar FROM users WHERE uid IN (?,?)',uid,data.guest);players.sort((a,b)=>a.uid===uid?-1:b.uid===uid?1:0);
  const result=await env.ARCADE.getByName(id).fetch('https://arcade/init',{method:'POST',body:JSON.stringify({id,game:data.game,players})});if(!result.ok)fail('Could not create the room.',503);
  await env.DB.prepare('INSERT INTO desktop_arcade_rooms(id,game,host,guest,created) VALUES(?,?,?,?,?)').bind(id,data.game,uid,data.guest,Date.now()).run();
  ctx.waitUntil(notify(env,data.guest,{type:'arcade-invite',id,game:data.game,from:uid}).catch(()=>{}));return json({id});
 }
 const room=await row(env,'SELECT * FROM desktop_arcade_rooms WHERE id=? AND (host=? OR guest=?) AND created>?',id,uid,uid,Date.now()-86400000);if(!room||!await friend(room.host,room.guest))fail('Game not found.',404);
 const stub=env.ARCADE.getByName(id);
 if(req.method==='DELETE'){await stub.fetch('https://arcade/close',{method:'POST'});await env.DB.prepare('DELETE FROM desktop_arcade_rooms WHERE id=?').bind(id).run();return json({ok:true})}
 if(req.method!=='GET')fail('Method not allowed.',405);
 if(match[2]){const headers=new Headers(req.headers);headers.set('x-arcade-user',uid);return stub.fetch(new Request('https://arcade/socket',{headers}))}
 return json({room,ticket:await issueTicket(env,uid,'arcade:'+id)});
}
