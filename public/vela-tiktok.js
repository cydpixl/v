// Vela TikTok link sharing: keeps TikTok videos hosted on TikTok.
const hosts=new Set(['www.tiktok.com','tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com']);
export function parseTikTok(value){
 for(const match of String(value||'').matchAll(/https:\/\/[^\s<>"']+/gi)){
  try{
   const u=new URL(match[0].replace(/[),.;\]}]+$/g,''));
   if(!hosts.has(u.hostname.toLowerCase())||u.protocol!=='https:'||u.port||u.username||u.password)continue;
   const id=u.pathname.match(/^\/(?:@[^/]+\/video|video|player\/v1)\/(\d{15,22})(?:\/|$)/)?.[1];
   if(!id&&!(/^\/t\/[a-zA-Z0-9_-]{3,80}\/?$/.test(u.pathname)||/^(vm|vt)\.tiktok\.com$/.test(u.hostname)&&/^\/[a-zA-Z0-9_-]{3,80}\/?$/.test(u.pathname)))continue;
   return {url:u.href,id:id||null};
  }catch{}
 }
 return null;
}
if(typeof document!=='undefined'){
 const KEY='vela.tiktok.pending';
 const css=document.createElement('style');
 css.textContent='.vela-tt-card{width:min(330px,100%);margin:12px 0;border:1px solid #333;border-radius:10px;background:#09090b;overflow:hidden;animation:ttfade .2s ease}.vela-tt-card header{display:flex;align-items:center;gap:8px;background:#151519;padding:10px 12px;color:white;font-size:13px}.vela-tt-card header a{margin-left:auto;color:#bbb!important;text-decoration:none!important;font-size:12px}.vela-tt-card iframe{display:block;width:100%;aspect-ratio:9/16;border:0;background:black}.vela-tt-card .tt-link{padding:25px;display:block;color:#ddd;font-size:13px}.vela-tt-modal{width:min(440px,calc(100vw - 24px));max-height:85dvh;margin:auto;border:1px solid #34343c;border-radius:14px;background:#141417;color:#eee;padding:0;box-shadow:0 18px 60px #0009}.vela-tt-modal::backdrop{background:#000a}.vela-tt-modal header{padding:18px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333}.vela-tt-modal header h2{font-size:20px;margin:0}.vela-tt-modal header button{font-size:24px;background:none;border:0;color:#ccc;cursor:pointer}.vela-tt-modal .tt-info{margin:20px;padding:14px;background:#232329;border-radius:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#bbb}.vela-tt-modal .tt-people{padding:0 12px 15px;max-height:46dvh;overflow:auto}.vela-tt-modal .tt-people button{display:block;width:100%;border:0;border-radius:7px;color:#fff;background:none;padding:14px;text-align:left;cursor:pointer}.vela-tt-modal .tt-people button:hover{background:#2b2b33}.vela-tt-modal .tt-error{color:#ff999f;font-size:12px;padding:0 20px}.vela-tt-modal footer{border-top:1px solid #333;padding:14px 20px;display:flex;justify-content:flex-end}.vela-tt-modal footer button{background:#292931;color:white;border:1px solid #444;border-radius:7px;padding:9px 12px}.vela-tt-modal button:disabled{opacity:.5}@keyframes ttfade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@media(max-width:650px){.vela-tt-card{width:min(310px,calc(100vw - 100px))}}@media(prefers-reduced-motion:reduce){.vela-tt-card{animation:none}}';
 document.head.append(css);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let dialogOpen=false,scheduled=false;
 function pending(){
  const loc=new URL(location.href),raw=loc.searchParams.get('share')||loc.searchParams.get('tiktok');
  if(raw){
   const item=parseTikTok(raw);
   if(item)sessionStorage.setItem(KEY,item.url);
   loc.searchParams.delete('share');loc.searchParams.delete('tiktok');
   history.replaceState(history.state,'',loc.pathname+loc.search+loc.hash);
  }
  return parseTikTok(sessionStorage.getItem(KEY));
 }
 function decorate(){
  for(const node of document.querySelectorAll('#messages .message-text,.pin-row p')){
   if(node.querySelector('.vela-tt-card')||node.closest('.editing-message'))continue;
   let item=null;
   for(const a of node.querySelectorAll('a[href]')){item=parseTikTok(a.href);if(item)break;}
   item ||=parseTikTok(node.textContent);
   if(!item)continue;
   const card=document.createElement('div');card.className='vela-tt-card';
   card.innerHTML='<header><strong>TikTok</strong><a target="_blank" rel="noopener noreferrer">Open in TikTok ↗</a></header>';
   card.querySelector('a').href=item.url;
   if(item.id){
    const iframe=document.createElement('iframe');iframe.title='TikTok video';iframe.loading='lazy';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allow='fullscreen; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;
    iframe.src='https://www.tiktok.com/player/v1/'+item.id+'?controls=1&description=1&autoplay=0';card.append(iframe);
   }else{
    const fallback=document.createElement('a');fallback.href=item.url;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.className='tt-link';fallback.textContent='Watch TikTok ↗';card.append(fallback);
   }
   node.append(card);
  }
 }
 async function send(cid,link){
  const row=[...document.querySelectorAll('#dm-list [data-open]')].find(x=>x.dataset.open===cid);
  if(!row)throw Error('Conversation not available.');
  row.click();let editor;
  for(let n=0;n<80;n++){
   if([...document.querySelectorAll('#dm-list [data-open].selected')].some(x=>x.dataset.open===cid)){editor=document.querySelector('#composer');if(editor?.closest('#composer-form'))break;}
   await new Promise(r=>setTimeout(r,100));
  }
  if(!editor)throw Error('Could not open conversation.');
  if(document.querySelector('#upload-preview')?.textContent?.trim()||document.querySelector('#reply-preview')?.textContent?.trim())throw Error('Finish your attachment or reply first.');
  const draft=editor.value||'';
  editor.value=link;editor.dispatchEvent(new Event('input',{bubbles:true}));
  editor.closest('#composer-form').requestSubmit();
  if(draft){editor.value=draft;editor.dispatchEvent(new Event('input',{bubbles:true}));}
 }
 function show(link){
  const conversations=[...document.querySelectorAll('#dm-list [data-open]')].map(row=>({id:row.dataset.open,name:row.querySelector('.dm-identity strong')?.textContent?.trim()||'Conversation'}));
  const dlg=document.createElement('dialog');dlg.className='vela-tt-modal';
  dlg.innerHTML='<header><h2>Send TikTok to Vela</h2><button type="button" data-close aria-label="Close">×</button></header><div class="tt-info">'+safe(link)+'</div><div class="tt-people">'+(conversations.length?conversations.map(c=>'<button type="button" data-send="'+safe(c.id)+'">'+safe(c.name)+' →</button>').join(''):'<p>Start a conversation in Vela first.</p>')+'</div><p class="tt-error" role="alert"></p><footer><button type="button" data-close>Cancel</button></footer>';
  (document.querySelector('#layers')||document.body).append(dlg);dialogOpen=true;
  dlg.addEventListener('close',()=>{dialogOpen=false;sessionStorage.removeItem(KEY);dlg.remove();});
  dlg.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>dlg.close());
  dlg.querySelectorAll('[data-send]').forEach(x=>x.onclick=async()=>{
   dlg.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await send(x.dataset.send,link);dlg.close();}
   catch(e){dlg.querySelector('.tt-error').textContent=e.message;dlg.querySelectorAll('button').forEach(b=>b.disabled=false);}
  });
  dlg.showModal();
 }
 function scan(){scheduled=false;decorate();const shared=pending();if(!dialogOpen&&shared&&document.querySelector('#dm-list')&&!document.querySelector('.auth-screen')&&!document.querySelector('.boot'))show(shared.url);}
 function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
 pending();
 const boot=()=>{new MutationObserver(queue).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});queue();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
