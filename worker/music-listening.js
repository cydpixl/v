import tracks from './default-music.json' with {type:'json'};
import {privateStatus} from './presence-privacy.js';
export async function musicListeningAPI(req,env,uid,{rows,json,fail}){
 if(new URL(req.url).pathname!=='/api/music-listening')return null;
 if(req.method!=='GET')fail('Method not allowed.',405);
 const friends=await rows(env,`SELECT u.uid,u.name,u.avatar,u.status,p.data FROM friends f
 JOIN users u ON u.uid=CASE WHEN f.a=? THEN f.b ELSE f.a END
 JOIN profile_extras p ON p.uid=u.uid
 WHERE f.status='accepted' AND (f.a=? OR f.b=?)
 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.uid=? AND b.target=u.uid) OR (b.target=? AND b.uid=u.uid)) LIMIT 100`,uid,uid,uid,uid,uid);
 const items=[];
 for(const friend of friends){
  let music;try{music=JSON.parse(friend.data).music}catch{continue}
  if(privateStatus(friend.status)||!music||!Number.isFinite(music.updated)||Date.now()-music.updated>60000)continue;
  const track=tracks.find(track=>track.title===music.title&&track.artist===music.artist);
  items.push({uid:friend.uid,name:friend.name,avatar:friend.avatar,music:{...music,trackId:track?.id||null}});
 }
 return json({items});
}
