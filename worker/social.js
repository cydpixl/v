import {socialLink} from '../src/social-links.mjs';
// Never forward credentials or follow a redirect outside TikTok's fixed host list.
export async function resolveSocial(value,fetcher=fetch) {
 let post=socialLink(value);
 if(!post)throw Object.assign(Error('Paste a TikTok or Instagram post link.'),{status:400});
 if(post.id)return post;
 const signal=AbortSignal.timeout(8000);
 for(let hop=0;hop<5;hop++) {
  const response=await fetcher(post.url,{redirect:'manual',signal,headers:{Accept:'text/html'}});
  const location=response.headers.get('Location');
  await response.body?.cancel();
  if(response.status<300||response.status>=400||!location)break;
  const next=socialLink(new URL(location,post.url).href);
  if(!next||next.provider!=='tiktok')break;
  if(next.id)return next;
  post=next;
 }
 throw Object.assign(Error('TikTok could not expand this short link. You can still send it, or open TikTok in Safari and copy the full post URL.'),{status:422});
}
export async function socialAPI(req,env,uid,h) {
 const url=new URL(req.url);
 if(url.pathname==='/api/social/resolve'&&req.method==='POST') {
  await h.limit(env,'social-resolve:'+uid,20);
  const data=await h.body(req);
  try{return h.json({post:await resolveSocial(data.url)});}catch(error){if(error.status)throw error;h.fail('TikTok did not respond. Send the link as-is or try again.',502);}
 }
 if(url.pathname!=='/api/social/posts'||req.method!=='GET')return null;
 const before=Number(url.searchParams.get('before'))||Date.now()+1,id=url.searchParams.get('id')||'\uffff',cid=url.searchParams.get('conversation');
 if(cid)await h.access(env,uid,cid);
 const found=await h.rows(env,`SELECT m.id,m.text,m.sender,m.created,m.conversation FROM messages m JOIN members a ON a.conversation=m.conversation AND a.uid=? WHERE m.deleted=0 AND NOT EXISTS(SELECT 1 FROM hidden_messages h WHERE h.uid=a.uid AND h.message=m.id) AND (m.created<? OR (m.created=? AND m.id<?)) ${cid?'AND m.conversation=?':''} AND (m.text LIKE '%tiktok.com/%' OR m.text LIKE '%instagram.com/%') ORDER BY m.created DESC,m.id DESC LIMIT 41`,uid,before,before,id,...(cid?[cid]:[]));
 const page=found.slice(0,40),last=page.at(-1);
 return h.json({posts:page.map(m=>({...m,post:socialLink(m.text)})).filter(m=>m.post),next:found.length>40&&last?{before:last.created,id:last.id}:null});
}
