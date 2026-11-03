import {requireCommunication} from './relationships.js';
import {cinemaItem} from './cinema-library.js';
export async function cinemaPartyAPI(req,env,uid,{json,body,fail,row,access,publish}){
 const match=new URL(req.url).pathname.match(/^\/api\/cinema-rooms\/([^/]+)$/);if(!match)return null;
 const cid=decodeURIComponent(match[1]);await access(env,uid,cid);await requireCommunication(env,uid,cid,fail);
 const now=Date.now(),stored=await row(env,'SELECT * FROM cinema_rooms WHERE conversation=?',cid),live=stored&&stored.updated>now-45000?{...JSON.parse(stored.state),revision:stored.revision,updated:stored.updated}:null;
 if(req.method==='GET')return json({state:live,serverNow:now});
 if(req.method==='DELETE'){
  const data=await body(req);if(live&&(live.controller!==uid||live.session!==data.session))fail('Only the hosting session can end this watch party.',403);
  await env.DB.prepare('DELETE FROM cinema_rooms WHERE conversation=? AND (updated<=? OR (json_extract(state,\'$.controller\')=? AND json_extract(state,\'$.session\')=?))').bind(cid,now-45000,uid,data.session||'').run();
  const current=await row(env,'SELECT updated FROM cinema_rooms WHERE conversation=?',cid);if(current&&current.updated>now-45000)fail('The room belongs to another hosting session.',409);
  await publish(env,cid,{type:'cinema-state',state:null,serverNow:now});return json({ok:true});
 }
 if(req.method!=='POST')fail('Method not allowed.',405);
 const data=await body(req),item=cinemaItem(data.item);
 if(!item||!Number.isFinite(data.position)||data.position<0||data.position>86400||typeof data.playing!=='boolean'||!/^[-a-zA-Z0-9]{20,64}$/.test(data.session||''))fail('Invalid watch session.');
 const state={item,source:'cinesrc',position:data.position,playing:data.playing,controller:uid,session:data.session,intent:['select','play','pause','seek','heartbeat'].includes(data.intent)?data.intent:'heartbeat'};
 // An atomic claim prevents two devices or tabs from becoming host together.
 const revision=await row(env,'INSERT INTO cinema_rooms(conversation,state,revision,updated) VALUES(?,?,1,?) ON CONFLICT(conversation) DO UPDATE SET state=excluded.state,revision=revision+1,updated=excluded.updated WHERE cinema_rooms.updated<=? OR (json_extract(cinema_rooms.state,\'$.controller\')=? AND json_extract(cinema_rooms.state,\'$.session\')=?) RETURNING revision',cid,JSON.stringify(state),now,now-45000,uid,data.session);
 if(!revision)fail('Another session is hosting. Join their watch party.',409);
 const result={...state,revision:revision.revision,updated:now};await publish(env,cid,{type:'cinema-state',state:result,serverNow:now});return json({state:result,serverNow:now});
}
