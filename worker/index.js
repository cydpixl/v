import {storageSQL,STORAGE_CAP} from './storage.js';
import {movieUploadAPI,cleanupMovieUploads} from './movie-uploads.js';
import {featureAPI} from './features.js';
import {expressionAPI,expressionAccess,gifById} from './expressions.js';
import {DurableObject} from 'cloudflare:workers';
import {createRemoteJWKSet,jwtVerify,SignJWT} from 'jose';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
const uuid=()=>crypto.randomUUID();
const pair=(a,b)=>[a,b].sort().join(':');
const row=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first();
const rows=async(env,sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results;
const run=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).run();
async function body(req){if(Number(req.headers.get('content-length'))>1000000)fail('Request too large.',413);let raw=await req.text();if(raw.length>1000000)fail('Request too large.',413);try{return JSON.parse(raw||'{}')}catch{fail('Invalid request.')}}
async function issueTicket(env,uid,scope){if(!env.API_TICKET_SECRET)fail('Connection credentials unavailable.',503);return new SignJWT({scope}).setProtectedHeader({alg:'HS256'}).setSubject(uid).setAudience('vela-api').setIssuer('vela').setIssuedAt().setExpirationTime(scope.startsWith('file:')?'1h':scope.startsWith('movie:')||scope.startsWith('expression:')?'4h':'2m').sign(new TextEncoder().encode(env.API_TICKET_SECRET));}
async function identity(req,env){
 const url=new URL(req.url),ticket=url.searchParams.get('ticket');
 if(ticket&&env.API_TICKET_SECRET){try{const {payload}=await jwtVerify(ticket,new TextEncoder().encode(env.API_TICKET_SECRET),{algorithms:['HS256'],issuer:'vela',audience:'vela-api'});const expected=url.pathname==='/api/live'?'live':url.pathname.match(/^\/api\/calls\/([^/]+)\/live$/)?'call:'+url.pathname.split('/')[3]:url.pathname.startsWith('/api/movie-media/')?'movie:'+url.pathname.slice(17):url.pathname.startsWith('/api/expression-media/')?'expression:'+url.pathname.slice(22):url.pathname.startsWith('/api/files/')?'file:'+url.pathname.slice(11):null;if(!expected||payload.scope!==expected||!payload.sub||req.method!=='GET')fail('Invalid connection credential.',401);return payload.sub;}catch{fail('Connection credential expired.',401)}}
 const cookie=req.headers.get('cookie')?.match(/(?:^|;\s*)__Host-pixl=([^;]+)/)?.[1];
 const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]||cookie;
 if(!token)fail('Sign in to continue.',401);
 if(env.TEST_AUTH==='local-only'&&new URL(req.url).hostname==='127.0.0.1'&&/^test:[a-z0-9-]+$/.test(token))return token.slice(5);
 try{const {payload}=await jwtVerify(token,keys,{issuer:'https://securetoken.google.com/cnx-cf-20260930',audience:'cnx-cf-20260930',algorithms:['RS256']});if(!payload.sub)fail('Invalid account.',401);return payload.sub}catch{fail('Your session expired. Sign in again.',401)}
}
async function limit(env,key,max=120,seconds=60){const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/seconds);const result=await row(env,'INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',key+':'+bucket,now+seconds);if(result.count>max)fail('Too many requests. Try again shortly.',429);}
async function notify(env,uid,event){await env.HUB.getByName(uid).publish(event);}
async function members(env,cid){return rows(env,'SELECT u.uid,u.handle,u.name,u.avatar,u.status,u.last_seen,m.last_read FROM members m JOIN users u ON u.uid=m.uid WHERE m.conversation=?',cid);}
async function access(env,uid,cid){const c=await row(env,'SELECT c.* FROM conversations c JOIN members m ON m.conversation=c.id WHERE c.id=? AND m.uid=?',cid,uid);if(!c)fail('Conversation not found.',404);return c;}
async function publish(env,cid,event){const list=await rows(env,'SELECT uid FROM members WHERE conversation=?',cid);await Promise.all(list.map(m=>notify(env,m.uid,{...event,conversation:cid})));}
async function blocked(env,a,b){return !!await row(env,'SELECT 1 FROM blocks WHERE (uid=? AND target=?) OR (uid=? AND target=?)',a,b,b,a);}
async function messages(env,cid,before,search,pins=false){
 const found=await rows(env,`SELECT * FROM messages WHERE conversation=? AND created<? ${pins?'AND pinned=1':''} ${search?'AND text LIKE ? ESCAPE CHAR(92)':''} ORDER BY created DESC,id DESC LIMIT 51`,cid,before||Date.now()+1,...(search?['%'+search.replace(/[\\%_]/g,'\\$&')+'%']:[]));
 const more=found.length>50;const page=found.slice(0,50);for(const m of page){m.attachment=m.attachment?JSON.parse(m.attachment):null;m.reactions=await rows(env,'SELECT emoji,uid FROM reactions WHERE message=?',m.id);}return {messages:page.reverse(),more};
}
async function api(req,env,ctx){
 const url=new URL(req.url),p=url.pathname,method=req.method;
 if(p==='/api/health')return json({service:'Vela',version:'1.3.0'});
 const origin=req.headers.get('Origin');if(origin&&origin!==url.origin&&origin!=='https://cydpixl.github.io'&&!(url.hostname==='127.0.0.1'&&new URL(origin).hostname==='127.0.0.1'))fail('Invalid origin.',403);
 const uid=await identity(req,env);if(method!=='GET')await limit(env,'write:'+uid,100);
 const helpers={json,fail,body,row,rows,run,access,publish,issueTicket};const feature=await movieUploadAPI(req,env,uid,helpers)||await expressionAPI(req,env,uid,helpers)||await featureAPI(req,env,uid,helpers);if(feature)return feature;

 if(p==='/api/ticket'&&method==='POST'){const b=await body(req),scope=clean(b.scope,150);if(scope!=='live'&&!/^call:[a-zA-Z0-9-]+$/.test(scope))fail('Invalid connection scope.');if(scope.startsWith('call:')){const call=await row(env,'SELECT conversation,status FROM calls WHERE id=?',scope.slice(5));if(!call||call.status==='ended')fail('This call has ended.',410);await access(env,uid,call.conversation);}return json({ticket:await issueTicket(env,uid,scope)});}
 if(p==='/api/file-links'&&method==='POST'){const b=await body(req),ids=[...new Set(Array.isArray(b.ids)?b.ids:[])];if(ids.length>50)fail('Too many files.');const links={};for(const id of ids){if(typeof id!=='string')fail('Invalid file.');const file=await row(env,'SELECT owner,conversation FROM uploads WHERE id=?',id);if(!file)continue;if(file.owner!==uid){if(!file.conversation)fail('File not found.',404);await access(env,uid,file.conversation);}links[id]=url.origin+'/api/files/'+encodeURIComponent(id)+'?ticket='+await issueTicket(env,uid,'file:'+id);}return json({links});}
 if(p==='/api/session'&&method==='POST'){
 
  const token=req.headers.get('Authorization')?.slice(7);return json({ok:true},200,{'Set-Cookie':`__Host-pixl=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3300`});
 }
 if(p==='/api/session'&&method==='DELETE')return json({ok:true},200,{'Set-Cookie':'__Host-pixl=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
 if(p==='/api/live'&&method==='GET'){
  if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')fail('WebSocket required.',426);
  return env.HUB.getByName(uid).fetch(new Request('https://internal/live',{headers:{Upgrade:'websocket','X-User':uid}}));
 }
 if(p==='/api/me'&&method==='GET')return json({user:await row(env,'SELECT * FROM users WHERE uid=?',uid)});
 if(p==='/api/me'&&method==='PUT'){
  const b=await body(req),existing=await row(env,'SELECT * FROM users WHERE uid=?',uid);const name=clean(b.name||existing?.name,48),handle=clean(b.handle||existing?.handle,20).toLowerCase();
  if(!name||!/^([a-z0-9_]){3,20}$/.test(handle))fail('Use a name and a username with 3–20 letters, numbers or underscores.');
  if(await row(env,'SELECT uid FROM users WHERE handle=? AND uid<>?',handle,uid))fail('That username is taken.',409);
  const avatar=clean(b.avatar??existing?.avatar,700000);if(avatar&&!/^https:\/\//.test(avatar)&&!/^data:image\/(png|jpeg|webp|gif);base64,/.test(avatar)&&!avatar.startsWith('/api/avatar/'))fail('Invalid avatar.');
  const status=['online','idle','dnd','invisible'].includes(b.status)?b.status:existing?.status||'online';
  await run(env,'INSERT INTO users(uid,handle,name,avatar,status,last_seen,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET handle=excluded.handle,name=excluded.name,avatar=excluded.avatar,status=excluded.status,last_seen=excluded.last_seen',uid,handle,name,avatar,status,Date.now(),existing?.created||Date.now());
  return json({user:await row(env,'SELECT * FROM users WHERE uid=?',uid)});
 }
 const me=await row(env,'SELECT * FROM users WHERE uid=?',uid);if(!me)fail('Choose your username first.',428);
 if(p==='/api/state'&&method==='GET'){
  const friends=await rows(env,'SELECT f.*,u.uid,u.handle,u.name,u.avatar,u.status AS presence,u.last_seen FROM friends f JOIN users u ON u.uid=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE f.a=? OR f.b=?',uid,uid,uid);
  const conversations=await rows(env,'SELECT c.*,m.last_read,(SELECT text FROM messages WHERE conversation=c.id AND deleted=0 ORDER BY created DESC LIMIT 1) AS preview,(SELECT count(*) FROM messages WHERE conversation=c.id AND sender<>? AND created>m.last_read) AS unread FROM conversations c JOIN members m ON m.conversation=c.id WHERE m.uid=? ORDER BY c.updated DESC',uid,uid);
  for(const c of conversations){c.members=await members(env,c.id);c.call=await row(env,"SELECT * FROM calls WHERE conversation=? AND status IN ('ringing','active') AND (status='active' OR created>?) ORDER BY created DESC LIMIT 1",c.id,Date.now()-90000);}
  return json({user:me,friends,conversations,blocks:await rows(env,'SELECT target FROM blocks WHERE uid=?',uid)});
 }
 if(p==='/api/friends'&&method==='POST'){
  const b=await body(req),target=await row(env,'SELECT * FROM users WHERE handle=?',clean(b.handle,20).toLowerCase());if(!target)fail('No account has that username.',404);if(target.uid===uid)fail('That is your own username.');if(await blocked(env,uid,target.uid))fail('This request is unavailable.',403);
  const [a,c]=[uid,target.uid].sort();const prior=await row(env,'SELECT * FROM friends WHERE a=? AND b=?',a,c);
  if(prior&&['accepted','pending'].includes(prior.status))fail(prior.status==='accepted'?'You are already friends.':'A request is already pending.',409);
  await run(env,'INSERT INTO friends(id,a,b,requested_by,status,created) VALUES(?,?,?,?,?,?) ON CONFLICT(a,b) DO UPDATE SET requested_by=excluded.requested_by,status=excluded.status,created=excluded.created',pair(a,c),a,c,uid,'pending',Date.now());
  await notify(env,target.uid,{type:'refresh'});return json({ok:true});
 }
 if(p.startsWith('/api/friends/')&&method==='PATCH'){
  const id=decodeURIComponent(p.slice(13)),f=await row(env,'SELECT * FROM friends WHERE id=? AND (a=? OR b=?)',id,uid,uid);if(!f)fail('Request not found.',404);const b=await body(req);
  if(b.action==='accept'){if(f.requested_by===uid||f.status!=='pending')fail('Cannot accept this request.',403);const now=Date.now();await env.DB.batch([env.DB.prepare("UPDATE friends SET status='accepted' WHERE id=?").bind(id),env.DB.prepare("INSERT OR IGNORE INTO conversations(id,kind,name,owner,created,updated) VALUES(?,'direct','',?,?,?)").bind(id,uid,now,now),env.DB.prepare('INSERT OR IGNORE INTO members(conversation,uid) VALUES(?,?)').bind(id,f.a),env.DB.prepare('INSERT OR IGNORE INTO members(conversation,uid) VALUES(?,?)').bind(id,f.b)]);}
  else if(['decline','cancel','remove'].includes(b.action)){if(b.action==='cancel'&&f.requested_by!==uid)fail('Cannot cancel this request.',403);await run(env,'DELETE FROM friends WHERE id=?',id);}else fail('Invalid action.');
  await Promise.all([notify(env,f.a,{type:'refresh'}),notify(env,f.b,{type:'refresh'})]);return json({ok:true});
 }
 if(p==='/api/conversations'&&method==='POST'){
  const b=await body(req),targets=[...new Set([uid,...(Array.isArray(b.members)?b.members:[])])];if(targets.length<2||targets.length>8)fail('Choose 1–7 friends.');
  for(const target of targets.filter(t=>t!==uid)){if(!await row(env,"SELECT 1 FROM friends WHERE a=? AND b=? AND status='accepted'",...[uid,target].sort())||await blocked(env,uid,target))fail('You can start conversations with friends.',403);}
  const direct=targets.length===2&&!b.group;const id=direct?pair(...targets):uuid(),now=Date.now();
  await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO conversations(id,kind,name,owner,created,updated) VALUES(?,?,?,?,?,?)').bind(id,direct?'direct':'group',clean(b.name,60),uid,now,now),...targets.map(t=>env.DB.prepare('INSERT OR IGNORE INTO members(conversation,uid) VALUES(?,?)').bind(id,t))]);
  await publish(env,id,{type:'refresh'});return json({id});
 }
 const scheduledMatch=p.match(/^\/api\/scheduled-messages(?:\/([a-zA-Z0-9-]+))?$/);
 if(scheduledMatch){
  await run(env,'CREATE TABLE IF NOT EXISTS scheduled_messages(id TEXT PRIMARY KEY,conversation TEXT NOT NULL,sender TEXT NOT NULL,text TEXT NOT NULL,reply_to TEXT,deliver_at INTEGER NOT NULL,created INTEGER NOT NULL)');await run(env,'CREATE INDEX IF NOT EXISTS scheduled_messages_due ON scheduled_messages(deliver_at)');
  const sid=scheduledMatch[1];
  if(method==='GET'){const items=await rows(env,'SELECT id,conversation,text,reply_to,deliver_at,created FROM scheduled_messages WHERE sender=? ORDER BY deliver_at',uid);return json({items});}
  if(method==='POST'&&!sid){const b=await body(req),id=clean(b.id,80),cid=clean(b.conversation,100),text=clean(b.text,4000),deliverAt=Number(b.deliverAt);if(!/^[a-zA-Z0-9-]{10,80}$/.test(id)||!text)fail('Write a message to schedule.');if(!Number.isFinite(deliverAt)||deliverAt<Date.now()+30000||deliverAt>Date.now()+31536000000)fail('Choose a time between one minute and one year from now.');await access(env,uid,cid);await run(env,'INSERT INTO scheduled_messages(id,conversation,sender,text,reply_to,deliver_at,created) VALUES(?,?,?,?,?,?,?)',id,cid,uid,text,b.replyTo||null,deliverAt,Date.now());return json({id,deliverAt},201);}
  if(method==='DELETE'&&sid){const found=await row(env,'SELECT sender FROM scheduled_messages WHERE id=?',sid);if(!found||found.sender!==uid)fail('Scheduled message not found.',404);await run(env,'DELETE FROM scheduled_messages WHERE id=?',sid);return json({ok:true});}
 }
 const conversationMatch=p.match(/^\/api\/conversations\/([^/]+)(?:\/(messages|read|typing|calls|leave))?$/);
 if(conversationMatch){
  const cid=decodeURIComponent(conversationMatch[1]),action=conversationMatch[2],c=await access(env,uid,cid);
  if(!action&&method==='PATCH'){if(c.kind!=='group'||c.owner!==uid)fail('Only the group owner can rename it.',403);const b=await body(req);await run(env,'UPDATE conversations SET name=? WHERE id=?',clean(b.name,60),cid);await publish(env,cid,{type:'refresh'});return json({ok:true});}
  if(action==='leave'&&method==='POST'){if(c.kind!=='group')fail('Only groups can be left.');await run(env,'DELETE FROM members WHERE conversation=? AND uid=?',cid,uid);if(c.owner===uid){const next=await row(env,'SELECT uid FROM members WHERE conversation=? LIMIT 1',cid);if(next)await run(env,'UPDATE conversations SET owner=? WHERE id=?',next.uid,cid);}await publish(env,cid,{type:'refresh'});return json({ok:true});}
  if(action==='messages'&&method==='GET')return json(await messages(env,cid,Number(url.searchParams.get('before'))||0,clean(url.searchParams.get('q'),100),url.searchParams.has('pins')));
  if(action==='messages'&&method==='POST'){
   await limit(env,'messages:'+uid,40);const b=await body(req),id=clean(b.id,80),text=clean(b.text,4000);if(!/^[a-zA-Z0-9-]{10,80}$/.test(id))fail('Invalid message identifier.');
   const people=await members(env,cid);for(const target of people.filter(m=>m.uid!==uid))if(await blocked(env,uid,target.uid))fail('Messaging is unavailable.',403);
   const att=b.upload?await row(env,'SELECT * FROM uploads WHERE id=? AND owner=? AND (conversation IS NULL OR conversation=?)',b.upload,uid,cid):null;
   let expressionAttachment=null;if(b.asset){const a=await expressionAccess(env,uid,b.asset,helpers);expressionAttachment={kind:a.kind,expressionId:a.id,name:a.name,type:a.type,size:a.size};}if(b.gif){const g=await gifById(env,b.gif);expressionAttachment={kind:'gif',name:g.name,url:g.url,type:'image/gif'};}for(const match of text.matchAll(/<:[a-zA-Z0-9_]{2,32}:([a-zA-Z0-9-]+)>/g))await expressionAccess(env,uid,match[1],helpers);
   if(!text&&!att&&!expressionAttachment)fail('Write a message or attach a file.');if(b.replyTo&&!await row(env,'SELECT 1 FROM messages WHERE id=? AND conversation=?',b.replyTo,cid))fail('Reply not found.');
   const prior=await row(env,'SELECT * FROM messages WHERE id=?',id);if(prior){if(prior.sender!==uid||prior.conversation!==cid)fail('Message identifier is in use.',409);return json({id});}
   const attachment=expressionAttachment?JSON.stringify(expressionAttachment):att?JSON.stringify({id:att.id,name:att.name,type:att.type,size:att.size}):null,now=Date.now();
   await env.DB.batch([env.DB.prepare('INSERT INTO messages(id,conversation,sender,text,attachment,reply_to,created) VALUES(?,?,?,?,?,?,?)').bind(id,cid,uid,text,attachment,b.replyTo||null,now),env.DB.prepare('UPDATE conversations SET updated=? WHERE id=?').bind(now,cid),...(att?[env.DB.prepare('UPDATE uploads SET conversation=? WHERE id=?').bind(cid,att.id)]:[])]);
   await publish(env,cid,{type:'message',id,sender:uid});return json({id});
  }
  if(action==='read'&&method==='POST'){await run(env,'UPDATE members SET last_read=? WHERE conversation=? AND uid=?',Date.now(),cid,uid);await publish(env,cid,{type:'read',uid});return json({ok:true});}
  if(action==='typing'&&method==='POST'){const b=await body(req);await publish(env,cid,{type:'typing',uid,typing:b.typing===true});return json({ok:true});}
  if(action==='calls'&&method==='POST'){
   await limit(env,'calls:'+uid,8);const b=await body(req);const people=await members(env,cid);for(const t of people.filter(p=>p.uid!==uid))if(await blocked(env,uid,t.uid))fail('Calling is unavailable.',403);
   await run(env,"UPDATE calls SET status='ended',ended=? WHERE conversation=? AND status='ringing' AND created<?",Date.now(),cid,Date.now()-90000);
   const current=await row(env,"SELECT * FROM calls WHERE conversation=? AND status IN ('ringing','active') ORDER BY created DESC LIMIT 1",cid);if(current)return json({call:current,members:people});
   const call={id:uuid(),conversation:cid,caller:uid,kind:b.kind==='video'?'video':'voice',status:'ringing',created:Date.now()};
   await run(env,'INSERT INTO calls(id,conversation,caller,kind,status,created) VALUES(?,?,?,?,?,?)',call.id,cid,uid,call.kind,call.status,call.created);await publish(env,cid,{type:'call',call});return json({call,members:people});
  }
 }
 const msgMatch=p.match(/^\/api\/messages\/([^/]+)$/);
 if(msgMatch){const id=msgMatch[1],m=await row(env,'SELECT * FROM messages WHERE id=?',id);if(!m)fail('Message not found.',404);await access(env,uid,m.conversation);
  if(method==='DELETE'){if(m.sender!==uid)fail('You can delete only your messages.',403);await env.DB.batch([env.DB.prepare("UPDATE messages SET text='',attachment=NULL,deleted=1 WHERE id=?").bind(id),env.DB.prepare('DELETE FROM reactions WHERE message=?').bind(id)]);}
  else if(method==='PATCH'){const b=await body(req);
   if('text'in b){if(m.sender!==uid||m.deleted)fail('You can edit only your messages.',403);if(!clean(b.text,4000))fail('A message cannot be empty.');await run(env,'UPDATE messages SET text=?,edited=? WHERE id=?',clean(b.text,4000),Date.now(),id);}
   else if('pinned'in b)await run(env,'UPDATE messages SET pinned=? WHERE id=?',b.pinned?1:0,id);
   else if(b.emoji){if(!['👍','❤️','😂','😮','😢','🔥','🎉'].includes(b.emoji))fail('Invalid reaction.');if(await row(env,'SELECT 1 FROM reactions WHERE message=? AND uid=? AND emoji=?',id,uid,b.emoji))await run(env,'DELETE FROM reactions WHERE message=? AND uid=? AND emoji=?',id,uid,b.emoji);else await run(env,'INSERT INTO reactions(message,uid,emoji) VALUES(?,?,?)',id,uid,b.emoji);}
   else if('bookmark'in b){if(b.bookmark)await run(env,'INSERT OR IGNORE INTO bookmarks(uid,message) VALUES(?,?)',uid,id);else await run(env,'DELETE FROM bookmarks WHERE uid=? AND message=?',uid,id);}else fail('Invalid action.');
  }else fail('Not found.',404);await publish(env,m.conversation,{type:'message-updated',id});return json({ok:true});
 }
 if(p==='/api/bookmarks'&&method==='GET')return json({messages:await rows(env,'SELECT m.* FROM messages m JOIN bookmarks b ON b.message=m.id JOIN members x ON x.conversation=m.conversation WHERE b.uid=? AND x.uid=? ORDER BY m.created DESC LIMIT 100',uid,uid)});
 if(p==='/api/blocks'&&method==='POST'){const b=await body(req);if(b.target===uid||!await row(env,'SELECT 1 FROM users WHERE uid=?',b.target))fail('Account not found.');if(b.blocked)await run(env,'INSERT OR IGNORE INTO blocks(uid,target) VALUES(?,?)',uid,b.target);else await run(env,'DELETE FROM blocks WHERE uid=? AND target=?',uid,b.target);return json({ok:true});}
 if(p==='/api/ice'&&method==='GET'){
  await limit(env,'ice:'+uid,12,3600);
  if(env.TURN_KEY_ID&&env.TURN_KEY){const res=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,{method:'POST',headers:{Authorization:'Bearer '+env.TURN_KEY,'Content-Type':'application/json'},body:JSON.stringify({ttl:14400}),signal:AbortSignal.timeout(8000)});if(!res.ok)fail('Relay credentials are unavailable. Try again.',503);const data=await res.json();let servers=Array.isArray(data.iceServers)?data.iceServers:[data.iceServers];servers=servers.filter(Boolean).map(s=>({...s,urls:(Array.isArray(s.urls)?s.urls:[s.urls]).filter(u=>!/:53(?:\?|$)/.test(u))}));return json({iceServers:servers,relay:true});}
  return json({iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}],relay:false});
 }
 const callMatch=p.match(/^\/api\/calls\/([^/]+)(?:\/(live|join|leave))?$/);
 if(callMatch){const call=await row(env,'SELECT * FROM calls WHERE id=?',callMatch[1]);if(!call)fail('Call not found.',404);await access(env,uid,call.conversation);const action=callMatch[2];
  if(action==='live'&&method==='GET'){if(call.status==='ended'||(call.status==='ringing'&&call.created<Date.now()-90000))fail('This call has ended.',410);if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')fail('WebSocket required.',426);return env.ROOM.getByName(call.id).fetch(new Request('https://internal/live',{headers:{Upgrade:'websocket','X-User':uid,'X-Call':call.id,'X-Conversation':call.conversation,'X-Device':/^[a-z0-9-]{10,80}$/i.test(url.searchParams.get('device')||'')?url.searchParams.get('device'):'legacy'}}));}
  if(action==='join'&&method==='POST'){if(call.status==='ended')fail('This call has ended.',410);if(await env.ROOM.getByName(call.id).count())await run(env,"UPDATE calls SET status='active' WHERE id=?",call.id);await publish(env,call.conversation,{type:'call-updated',id:call.id});return json({call:{...call,status:'active'},members:await members(env,call.conversation)});}
  if(action==='leave'&&method==='POST'){const data=await body(req);await env.ROOM.getByName(call.id).leave(uid,data.device||'legacy');const remaining=await env.ROOM.getByName(call.id).count();if(!remaining){await run(env,"UPDATE calls SET status='ended',ended=? WHERE id=?",Date.now(),call.id);await publish(env,call.conversation,{type:'call-ended',id:call.id});}return json({ok:true});}
 }
 if(p==='/api/uploads'&&method==='POST'){
  const size=Number(req.headers.get('Content-Length')),type=req.headers.get('Content-Type')||'application/octet-stream',name=clean(decodeURIComponent(req.headers.get('X-File-Name')||'File'),150);
  if(!size||size>25*1024*1024)fail('Files can be up to 25 MB.',413);if(!/^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|audio\/(mpeg|mp4|ogg|webm|wav)|application\/(pdf|zip|octet-stream)|text\/plain)$/.test(type))fail('That file type is not supported.');
  
  const total=await row(env,'SELECT coalesce(sum(size),0) AS n FROM uploads WHERE owner=? AND created>?',uid,Date.now()-86400000);if(total.n+size>250*1024*1024)fail('Daily upload allowance reached.',429);
  const id=uuid(),reserved=await row(env,'INSERT INTO uploads(id,owner,name,type,size,created) SELECT ?,?,?,?,?,? WHERE ('+storageSQL+')+?<=? RETURNING id',id,uid,name,type,size,Date.now(),Date.now(),size,STORAGE_CAP);if(!reserved)fail('Storage allowance reached.',507);try{await env.FILES.put(id,req.body,{httpMetadata:{contentType:type},customMetadata:{name,owner:uid}})}catch(error){await run(env,'DELETE FROM uploads WHERE id=?',id);throw error}return json({upload:{id,name,type,size}});
 }
 if(p.startsWith('/api/files/')&&method==='GET'){
  const id=p.slice(11),u=await row(env,'SELECT * FROM uploads WHERE id=?',id);if(!u)fail('File not found.',404);if(u.owner!==uid){if(!u.conversation)fail('Not found.',404);await access(env,uid,u.conversation);}
  const file=await env.FILES.get(id,{range:req.headers});if(!file)fail('File not found.',404);const h=new Headers({'Content-Type':u.type,'X-Content-Type-Options':'nosniff','Cache-Control':'private,max-age=300','Accept-Ranges':'bytes'});h.set('Content-Disposition',`${u.type.startsWith('image/')||u.type.startsWith('video/')||u.type.startsWith('audio/')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(u.name)}`);const partial=!!req.headers.get('Range')&&!!file.range;if(partial){h.set('Content-Range',`bytes ${file.range.offset}-${file.range.offset+file.range.length-1}/${file.size}`);h.set('Content-Length',String(file.range.length));}return new Response(file.body,{status:partial?206:200,headers:h});
 }
 fail('Not found.',404);
}
export default {async fetch(req,env,ctx){const origin=req.headers.get('Origin');const corsAllowed=origin==='https://cydpixl.github.io'||origin===new URL(req.url).origin||(new URL(req.url).hostname==='127.0.0.1'&&origin&&new URL(origin).hostname==='127.0.0.1');if(req.method==='OPTIONS')return new Response(null,{status:corsAllowed?204:403,headers:corsAllowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-File-Name,Range','Access-Control-Max-Age':'3600','Vary':'Origin'}:{}});const response=await handle(req,env,ctx);if(response.status===101||!corsAllowed||!origin)return response;const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Expose-Headers','Content-Range,Content-Length,Accept-Ranges,Date');return new Response(response.body,{status:response.status,headers});},async scheduled(event,env){await cleanupMovieUploads(env);await run(env,'DELETE FROM rate_limits WHERE expires<?',Math.floor(Date.now()/1000)-3600);const due=await rows(env,'SELECT * FROM scheduled_messages WHERE deliver_at<=? ORDER BY deliver_at LIMIT 100',Date.now());for(const item of due){const member=await row(env,'SELECT 1 FROM members WHERE conversation=? AND uid=?',item.conversation,item.sender);if(!member){await run(env,'DELETE FROM scheduled_messages WHERE id=?',item.id);continue}const now=Date.now();await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO messages(id,conversation,sender,text,reply_to,created) VALUES(?,?,?,?,?,?)').bind(item.id,item.conversation,item.sender,item.text,item.reply_to,now),env.DB.prepare('UPDATE conversations SET updated=? WHERE id=?').bind(now,item.conversation),env.DB.prepare('DELETE FROM scheduled_messages WHERE id=?').bind(item.id)]);await publish(env,item.conversation,{type:'message',id:item.id,sender:item.sender});}for(const call of await rows(env,"SELECT id,conversation FROM calls WHERE status<>'ended' AND created<?",Date.now()-14400000)){if(await env.ROOM.getByName(call.id).count())continue;await run(env,"UPDATE calls SET status='ended',ended=? WHERE id=?",Date.now(),call.id);await publish(env,call.conversation,{type:'call-ended',id:call.id});}}};
async function handle(req,env,ctx){try{const path=new URL(req.url).pathname;if(path==='/'||path==='/index.html')return Response.redirect('https://cydpixl.github.io/v/',302);if(path.startsWith('/api/'))return await api(req,env,ctx);const res=await env.ASSETS.fetch(req);const headers=new Headers(res.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('Permissions-Policy','camera=(self), microphone=(self), display-capture=(self)');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self' blob: https:; connect-src 'self' wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");return new Response(res.body,{status:res.status,headers});}catch(e){if(!e.status)console.error(JSON.stringify({event:'request-error',message:e.message,path:new URL(req.url).pathname}));return json({error:e.status?e.message:'Something went wrong. Please retry.'},e.status||500);}}

export class UserHub extends DurableObject{
 async publish(event){for(const socket of this.ctx.getWebSockets())try{socket.send(JSON.stringify(event))}catch{}}
 async fetch(req){const [client,server]=Object.values(new WebSocketPair());const uid=req.headers.get('X-User');this.ctx.acceptWebSocket(server);server.serializeAttachment({uid});server.send(JSON.stringify({type:'ready'}));await run(this.env,'UPDATE users SET last_seen=? WHERE uid=?',Date.now(),uid);return new Response(null,{status:101,webSocket:client});}
 async webSocketMessage(ws,message){if(message==='ping'){ws.send('pong');const {uid}=ws.deserializeAttachment();await run(this.env,'UPDATE users SET last_seen=? WHERE uid=?',Date.now(),uid);}}
 webSocketClose(ws,code,reason){try{ws.close(code,reason)}catch{}}
 webSocketError(ws){try{ws.close(1011,'Connection interrupted')}catch{}}
}
export class CallRoom extends DurableObject{
 async count(){return this.ctx.getWebSockets().filter(w=>w.readyState===1).length;}
 send(event,except){for(const ws of this.ctx.getWebSockets())if(ws!==except&&ws.readyState===1)try{ws.send(JSON.stringify(event))}catch{}}
 async leave(uid,device='legacy',transfer=false){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.uid===uid&&(transfer||(a.device||'legacy')===device)){this.send({type:'peer-left',uid},ws);try{ws.close(transfer?4001:1000,transfer?'Transferred to another device':'Left call')}catch{}}}}
 async fetch(req){const uid=req.headers.get('X-User'),call=req.headers.get('X-Call'),cid=req.headers.get('X-Conversation'),device=req.headers.get('X-Device')||'legacy';const previous=this.ctx.getWebSockets(uid).filter(w=>w.readyState===1).map(w=>w.deserializeAttachment());if(device==='legacy'&&previous.some(p=>p.device&&p.device!=='legacy')){await notify(this.env,uid,{type:'call-ended',id:call,legacyOnly:true});return json({error:'Call transferred to another device.'},409)}await this.leave(uid,device,true);if(device!=='legacy'&&previous.some(p=>!p.device||p.device==='legacy'))await notify(this.env,uid,{type:'call-ended',id:call,legacyOnly:true});const peers=this.ctx.getWebSockets().filter(w=>w.readyState===1).map(w=>w.deserializeAttachment());if(peers.length){await run(this.env,"UPDATE calls SET status='active' WHERE id=?",call);await publish(this.env,cid,{type:'call-updated',id:call});}if(peers.length>=8)return json({error:'This call is full.'},409);const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server,[uid]);server.serializeAttachment({uid,call,cid,device,state:{mic:true,camera:false,screen:false},at:Date.now(),count:0});server.send(JSON.stringify({type:'peers',peers:peers.map(p=>({uid:p.uid,state:p.state}))}));this.send({type:'peer-joined',uid},server);return new Response(null,{status:101,webSocket:client});}
 async webSocketMessage(ws,raw){if(typeof raw!=='string'||raw.length>80000){ws.close(1009,'Message too large');return}const owner=ws.deserializeAttachment();let msg;try{msg=JSON.parse(raw)}catch{return}if(Date.now()-owner.at>10000){owner.at=Date.now();owner.count=0;}if(++owner.count>250){ws.close(1008,'Too many signals');return}ws.serializeAttachment(owner);
  if(msg.type==='ping'){ws.send(JSON.stringify({type:'pong'}));return;}
  if(msg.type==='state'){owner.state={mic:msg.state?.mic===true,camera:msg.state?.camera===true,screen:msg.state?.screen===true,deaf:msg.state?.deaf===true};ws.serializeAttachment(owner);this.send({type:'state',uid:owner.uid,state:owner.state},ws);return;}
  if(!['description','candidate'].includes(msg.type)||typeof msg.to!=='string')return;
  if(msg.type==='description'&&(!['offer','answer'].includes(msg.description?.type)||typeof msg.description?.sdp!=='string'||msg.description.sdp.length>60000))return;
  for(const target of this.ctx.getWebSockets(msg.to))if(target.readyState===1)try{target.send(JSON.stringify({...msg,from:owner.uid,to:msg.to}))}catch{}
 }
 async webSocketClose(ws,code,reason){const owner=ws.deserializeAttachment();await this.ctx.storage.put('room',{call:owner.call,cid:owner.cid});await this.ctx.storage.setAlarm(Date.now()+30000);if(!this.ctx.getWebSockets(owner.uid).some(other=>other!==ws&&other.readyState===1))this.send({type:'peer-left',uid:owner.uid},ws);try{ws.close(code,reason)}catch{}}
 webSocketError(ws){return this.webSocketClose(ws,1011,'Connection interrupted');}
 async alarm(){if(await this.count())return;const room=await this.ctx.storage.get('room');if(room){await run(this.env,"UPDATE calls SET status='ended',ended=? WHERE id=?",Date.now(),room.call);await publish(this.env,room.cid,{type:'call-ended',id:room.call});}}
}
