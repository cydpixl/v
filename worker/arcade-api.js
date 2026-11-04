import {MULTIPLAYER_GAMES} from '../src/games/arcade-model.mjs';
const ready=new WeakSet();
export async function arcadeAPI(req,env,uid,{row,rows,body,json,fail,issueTicket,notify,ctx}){
 const path=new URL(req.url).pathname,match=path.match(/^\/api\/arcade-rooms(?:\/([a-f0-9-]{36})(\/socket)?)?$/);if(!match)return null;
 if(!ready.has(env)){await env.DB.prepare('CREATE TABLE IF NOT EXISTS desktop_arcade_rooms(id TEXT PRIMARY KEY,game TEXT NOT NULL,host TEXT NOT NULL,guest TEXT NOT NULL,created INTEGER NOT NULL)').run();await env.DB.prepare('CREATE INDEX IF NOT EXISTS desktop_arcade_members ON desktop_arcade_rooms(host,guest,created)').run();await env.DB.prepare('CREATE TABLE IF NOT EXISTS desktop_game_invitations(id TEXT PRIMARY KEY,status TEXT NOT NULL,expires INTEGER NOT NULL)').run();ready.add(env)}
 const friend=async(a,b)=>a!==b&&!!await row(env,`SELECT 1 FROM friends WHERE status='accepted' AND ((a=? AND b=?) OR (a=? AND b=?)) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (uid=? AND target=?) OR (target=? AND uid=?))`,a,b,b,a,a,b,a,b);
 const id=match[1];
 if(!id){
  if(req.method==='GET'){const found=await rows(env,'SELECT r.*,i.status AS invite_status,i.expires AS invite_expires,h.name AS host_name,g.name AS guest_name,h.avatar AS host_avatar,g.avatar AS guest_avatar FROM desktop_arcade_rooms r LEFT JOIN desktop_game_invitations i ON i.id=r.id JOIN users h ON h.uid=r.host JOIN users g ON g.uid=r.guest WHERE (host=? OR guest=?) AND r.created>? AND (i.id IS NULL OR i.expires>?) ORDER BY r.created DESC LIMIT 30',uid,uid,Date.now()-86400000,Date.now());const items=[];for(const room of found)if((!room.invite_status||room.invite_expires>Date.now())&&await friend(room.host,room.guest))items.push(room);return json({items})}
  if(req.method!=='POST')fail('Method not allowed.',405);
  const data=await body(req);if(!MULTIPLAYER_GAMES.includes(data.game)||typeof data.guest!=='string'||!await friend(uid,data.guest))fail('Choose a game and an accepted friend.',403);
  if(data.invitation){const prior=await row(env,`SELECT r.id,r.guest,i.status FROM desktop_arcade_rooms r JOIN desktop_game_invitations i ON i.id=r.id WHERE r.game=? AND ((r.host=? AND r.guest=?) OR (r.host=? AND r.guest=?)) AND i.expires>? AND i.status IN ('pending','accepted') ORDER BY r.created DESC LIMIT 1`,data.game,uid,data.guest,data.guest,uid,Date.now());if(prior){if(prior.guest===uid&&prior.status==='pending'){await env.DB.prepare("UPDATE desktop_game_invitations SET status='accepted',expires=? WHERE id=? AND status='pending' AND expires>?").bind(Date.now()+86400000,prior.id,Date.now()).run();ctx.waitUntil(notify(env,data.guest,{type:'arcade-invite-updated',id:prior.id,status:'accepted'}).catch(()=>{}))}return json({id:prior.id})}}
  const count=await row(env,'SELECT COUNT(*) AS n FROM desktop_arcade_rooms r LEFT JOIN desktop_game_invitations i ON i.id=r.id WHERE r.host=? AND r.created>? AND (i.id IS NULL OR i.expires>?)',uid,Date.now()-86400000,Date.now());if(count.n>=20)fail('You have too many active games. Finish a game before inviting again.');
  const id=crypto.randomUUID(),players=await rows(env,'SELECT uid,name,avatar FROM users WHERE uid IN (?,?)',uid,data.guest);players.sort((a,b)=>a.uid===uid?-1:b.uid===uid?1:0);
  const result=await env.ARCADE.getByName(id).fetch('https://arcade/init',{method:'POST',body:JSON.stringify({id,game:data.game,players})});if(!result.ok)fail('Could not create the room.',503);
  await env.DB.prepare('INSERT INTO desktop_arcade_rooms(id,game,host,guest,created) VALUES(?,?,?,?,?)').bind(id,data.game,uid,data.guest,Date.now()).run();
  if(data.invitation)await env.DB.prepare("INSERT INTO desktop_game_invitations(id,status,expires) VALUES(?,'pending',?)").bind(id,Date.now()+120000).run();
  ctx.waitUntil(notify(env,data.guest,{type:'arcade-invite',id,game:data.game,from:uid}).catch(()=>{}));return json({id});
 }
 const room=await row(env,'SELECT * FROM desktop_arcade_rooms WHERE id=? AND (host=? OR guest=?) AND created>?',id,uid,uid,Date.now()-86400000);if(!room||!await friend(room.host,room.guest))fail('Game not found.',404);
 const invitation=await row(env,'SELECT * FROM desktop_game_invitations WHERE id=?',id);
 if(invitation&&invitation.expires<=Date.now())fail('Invitation expired. Send a new invitation.',410);
 const stub=env.ARCADE.getByName(id);
 if(req.method==='POST'){
  if(!invitation||room.guest!==uid)fail('Only the invited friend can accept.',403);
  const data=await body(req);if(data.action!=='accept')fail('Choose accept.');
  await env.DB.prepare("UPDATE desktop_game_invitations SET status='accepted',expires=? WHERE id=? AND status='pending' AND expires>?").bind(Date.now()+86400000,id,Date.now()).run();
  const current=await row(env,'SELECT status,expires FROM desktop_game_invitations WHERE id=?',id);if(current?.status!=='accepted'||current.expires<=Date.now())fail('Invitation expired.',410);
  ctx.waitUntil(Promise.all([room.host,room.guest].map(target=>notify(env,target,{type:'arcade-invite-updated',id,game:room.game,status:'accepted'}))).catch(()=>{}));return json({id,game:room.game});
 }
 if(invitation?.status==='pending'&&room.guest===uid&&req.method==='GET')fail('Accept the invitation first.',403);
 if(req.method==='DELETE'){await stub.fetch('https://arcade/close',{method:'POST'});await env.DB.prepare('DELETE FROM desktop_arcade_rooms WHERE id=?').bind(id).run();await env.DB.prepare('DELETE FROM desktop_game_invitations WHERE id=?').bind(id).run();ctx.waitUntil(notify(env,uid===room.host?room.guest:room.host,{type:'arcade-invite-updated',id,status:'closed'}).catch(()=>{}));return json({ok:true})}
 if(req.method!=='GET')fail('Method not allowed.',405);
 if(match[2]){const headers=new Headers(req.headers);headers.set('x-arcade-user',uid);return stub.fetch(new Request('https://arcade/socket',{headers}))}
 return json({room,ticket:await issueTicket(env,uid,'arcade:'+id)});
}
