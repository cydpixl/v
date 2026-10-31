// Each member uses an indexed latest-card lookup; pins use a separate partial
// index. Never rank or scan the full conversation history on player refresh.
export async function liveMusicAPI(req,env,uid,h){
 const url=new URL(req.url),match=url.pathname.match(/^\/api\/conversations\/([^/]+)\/live-music$/);
 if(req.method!=='GET')return null;
 if(url.pathname==='/api/live-music-shares'){
  const messages=await h.rows(env,`SELECT m.id,m.conversation,m.created,m.text,m.pinned FROM members p JOIN messages m ON m.id=(
   SELECT id FROM messages WHERE conversation=p.conversation AND sender=p.uid AND deleted=0 AND text LIKE '[[vela-live-music:1:%' ORDER BY created DESC,id DESC LIMIT 1
  ) WHERE p.uid=? UNION SELECT m.id,m.conversation,m.created,m.text,m.pinned FROM messages m JOIN members p ON p.conversation=m.conversation AND p.uid=? WHERE m.sender=? AND m.deleted=0 AND m.pinned=1 AND m.text LIKE '[[vela-live-music:1:%'`,uid,uid,uid);
  return h.json({messages});
 }
 if(!match)return null;
 const cid=decodeURIComponent(match[1]);await h.access(env,uid,cid);
 const messages=await h.rows(env,`SELECT m.id,m.conversation,m.sender,m.text,m.pinned,m.created,m.edited FROM members p JOIN messages m ON m.id=(
  SELECT id FROM messages WHERE conversation=p.conversation AND sender=p.uid AND deleted=0 AND text LIKE '[[vela-live-music:1:%' ORDER BY created DESC,id DESC LIMIT 1
 ) WHERE p.conversation=? UNION SELECT id,conversation,sender,text,pinned,created,edited FROM messages WHERE conversation=? AND deleted=0 AND pinned=1 AND text LIKE '[[vela-live-music:1:%' ORDER BY pinned DESC,created DESC,id DESC`,cid,cid);
 return h.json({messages});
}
