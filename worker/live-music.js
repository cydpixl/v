// Music messages remain regular chat messages. Read them independently of the
// latest history page so pinning and listening do not depend on scrolling.
export async function liveMusicAPI(req,env,uid,h){
 const url=new URL(req.url),match=url.pathname.match(/^\/api\/conversations\/([^/]+)\/live-music$/);
 if(req.method!=='GET')return null;
 if(url.pathname==='/api/live-music-shares'){
  const messages=await h.rows(env,`WITH shared AS (
   SELECT m.id,m.conversation,m.created,m.text,m.pinned,
    ROW_NUMBER() OVER (PARTITION BY m.conversation ORDER BY m.created DESC,m.id DESC) AS rank
   FROM messages m JOIN members x ON x.conversation=m.conversation AND x.uid=?
   WHERE m.sender=? AND m.deleted=0 AND m.text LIKE '[[vela-live-music:1:%'
  ) SELECT id,conversation,created,text,pinned FROM shared WHERE rank=1 OR pinned=1`,uid,uid);
  return h.json({messages});
 }
 if(!match)return null;
 const cid=decodeURIComponent(match[1]);await h.access(env,uid,cid);
 const messages=await h.rows(env,`WITH shared AS (
  SELECT id,conversation,sender,text,pinned,created,edited,
   ROW_NUMBER() OVER (PARTITION BY sender ORDER BY created DESC,id DESC) AS rank
  FROM messages WHERE conversation=? AND deleted=0 AND text LIKE '[[vela-live-music:1:%'
 ) SELECT id,conversation,sender,text,pinned,created,edited FROM shared
 WHERE rank=1 OR pinned=1 ORDER BY pinned DESC,created DESC,id DESC`,cid);
 return h.json({messages});
}
