import {libraryMovie} from '../src/cinema/library-source.mjs';
import {VELA_BOT_UID,bodycamItems} from '../src/commands.mjs';

export async function commandAPI(req,env,uid,h){
 const url=new URL(req.url),match=url.pathname.match(/^\/api\/conversations\/([^/]+)\/commands$/);
 if(!match||req.method!=='POST')return;
 const cid=decodeURIComponent(match[1]);await h.access(env,uid,cid);
 const b=await h.body(req),requestId=String(b.id||''),command=b.command,args=String(b.args||'').trim().slice(0,160);
 if(!/^[a-zA-Z0-9-]{10,80}$/.test(requestId)||!['bodycam','dailydose','help'].includes(command))h.fail('Unknown command or invalid request.');
 const id='vela-'+requestId;
 async function existing(){const value=await h.row(env,'SELECT * FROM messages WHERE id=?',id);if(!value)return null;value.attachment=value.attachment?JSON.parse(value.attachment):null;if(value.conversation!==cid||value.sender!==VELA_BOT_UID||value.attachment?.requestedBy!==uid||value.attachment?.command!==command||value.attachment?.query!==args)h.fail('Command identifier is in use.',409);value.reactions=await h.rows(env,'SELECT emoji,uid FROM reactions WHERE message=?',id);return value;}
 const prior=await existing();if(prior)return h.json({id,message:prior});
 for(const member of await h.members(env,cid))if(member.uid!==uid&&await h.blocked(env,uid,member.uid))h.fail('Messaging is unavailable.',403);
 await h.limit(env,'commands:'+uid,12);
 const common={requestedBy:uid,command,query:args};
 const category=command==='dailydose'?'daily-dose':'bodycam';
 const items=command!=='help'?bodycamItems((await h.rows(env,"SELECT id,data,object_key FROM movies WHERE json_extract(data,'$.category')=? ORDER BY created DESC LIMIT 150",category)).map(libraryMovie),args,category):[];
 const attachment=command!=='help'?{...common,kind:category==='bodycam'?'bodycam-library':'daily-dose-library',items}:{...common,kind:'command-help'};
 const now=Date.now(),text=command!=='help'?(category==='bodycam'?'Bodycam':'Daily Dose of Internet')+' · '+items.length+' videos':'VELA commands';
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO messages(id,conversation,sender,text,attachment,created) VALUES(?,?,?,?,?,?)').bind(id,cid,VELA_BOT_UID,text,JSON.stringify(attachment),now),
  env.DB.prepare('UPDATE conversations SET updated=MAX(updated,?) WHERE id=?').bind(now,cid),
 ]);
 const message=await existing();
 h.ctx.waitUntil(h.publish(env,cid,{type:'message',id,sender:VELA_BOT_UID,message}).catch(error=>console.error('command-publish',id,error.message)));
 return h.json({id,message});
}
