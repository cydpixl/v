export function cinemaItem(value){
 const id=Number(value?.id);if(!Number.isSafeInteger(id)||id<1||!['movie','tv'].includes(value?.type)||typeof value?.title!=='string'||!value.title.trim()||value.title.length>160)return null;
 const image=url=>typeof url==='string'&&/^https:\/\/image\.tmdb\.org\/t\/p\/[A-Za-z0-9_/-]+\.(?:jpg|png|webp|svg)$/.test(url)?url:'';
 return {id,type:value.type,title:value.title.trim(),season:Math.max(1,Math.min(200,Math.floor(value.season)||1)),episode:Math.max(1,Math.min(1000,Math.floor(value.episode)||1)),poster:image(value.poster),backdrop:image(value.backdrop),year:String(value.year||'').slice(0,4),description:String(value.description||'').slice(0,3000)};
}
export async function cinemaLibraryAPI(req,env,uid,{json,body,fail,rows}){
 const url=new URL(req.url),path=url.pathname;if(path!=='/api/cinema-library')return null;const apple=url.searchParams.get('app')==='apple-tv',scope=apple?'apple-tv:':'',pattern='apple-tv:%',operator=apple?'LIKE':'NOT LIKE';
 if(req.method==='GET'){const [saved,history]=await Promise.all([rows(env,`SELECT data FROM movie_lists WHERE uid=? AND id ${operator} ?`,uid,pattern),rows(env,`SELECT data,position,duration,updated FROM cinema_progress WHERE uid=? AND id ${operator} ? ORDER BY updated DESC LIMIT 100`,uid,pattern)]);return json({saved:saved.map(x=>JSON.parse(x.data)),history:history.map(x=>({...x,item:JSON.parse(x.data),data:undefined}))})}
 if(req.method==='POST'){const data=await body(req),item=cinemaItem(data.item);if(!item||typeof data.saved!=='boolean')fail('Invalid library item.');const id=scope+item.type+':'+item.id;if(data.saved)await env.DB.prepare('INSERT INTO movie_lists(uid,id,data) VALUES(?,?,?) ON CONFLICT(uid,id) DO UPDATE SET data=excluded.data').bind(uid,id,JSON.stringify(item)).run();else await env.DB.prepare('DELETE FROM movie_lists WHERE uid=? AND id=?').bind(uid,id).run();return json({ok:true});}
 if(req.method!=='PUT')fail('Method not allowed.',405);const data=await body(req),item=cinemaItem(data.item);
 if(!item||!Number.isFinite(data.position)||data.position<0||!Number.isFinite(data.duration)||data.duration<=0||data.duration>86400||data.position>data.duration+5)fail('Invalid playback progress.');
 const id=`${scope}${item.type}:${item.id}:${item.type==='tv'?item.season+':'+item.episode:'film'}`;
 await env.DB.prepare('INSERT INTO cinema_progress(uid,id,data,position,duration,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(uid,id) DO UPDATE SET data=excluded.data,position=excluded.position,duration=excluded.duration,updated=excluded.updated').bind(uid,id,JSON.stringify(item),data.position,data.duration,Date.now()).run();return json({ok:true});
}
