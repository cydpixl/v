import {escape as e,messageHTML,date,renderEmoji} from './util.js';

export function openMessageSearch({S,api,modal,openChat,user,title,settings,jump,toast}){
 const panel=modal('Search Vela','<input type="search" class="full-input" aria-label="Search Vela" placeholder="Search messages, people, media or settings"><nav class="connection-filters" aria-label="Search filters"></nav><p role="status" data-search-status></p><div class="connection-results" aria-busy="false"></div><button class="secondary" data-more hidden>Load more</button><button class="secondary" data-retry hidden>Retry search</button>',{wide:true});
 const input=panel.querySelector('input'),target=panel.querySelector('.connection-results'),status=panel.querySelector('[data-search-status]'),moreButton=panel.querySelector('[data-more]'),retryButton=panel.querySelector('[data-retry]');
 const owner=S.user?.uid,session=S.session;
 let filter='all',timer,items=[],more=false,epoch=0,controller,loading=false,retryAppend=false;
 const filters=[['all','All'],['photos','Photos'],['videos','Videos'],['links','Links'],['mine','From me'],['people','People'],['settings','Settings'],['saved','Saved'],['pinned','Pinned']];
 panel.querySelector('nav').innerHTML=filters.map(([id,label])=>`<button class="secondary" data-filter="${id}" aria-pressed="${id===filter}">${label}</button>`).join('');
 const safe=fn=>Promise.resolve().then(fn).catch(error=>toast(error.message));
 const valid=id=>id===epoch&&panel.open&&panel.isConnected&&S.user?.uid===owner&&S.session===session;
 function invalidate(){epoch++;controller?.abort();clearTimeout(timer);loading=false;moreButton.hidden=true;retryButton.hidden=true;target.setAttribute('aria-busy','true');}
 function paint(q,selected){
  target.replaceChildren();
  if(['all','people'].includes(selected))for(const c of S.conversations.filter(c=>title(c).toLowerCase().includes(q.toLowerCase()))){
   const button=document.createElement('button');button.textContent=title(c);button.onclick=()=>{panel.close();safe(()=>openChat(c.id));};target.append(button);
  }
  if(['all','settings'].includes(selected))for(const [id,label] of [['account','Account'],['voice','Voice & Video'],['notifications','Notifications'],['appearance','Appearance'],['privacy','Data & Privacy']])if(label.toLowerCase().includes(q.toLowerCase())){
   const button=document.createElement('button');button.textContent=label+' settings';button.onclick=()=>{panel.close();safe(()=>settings(id));};target.append(button);
  }
  for(const msg of items){
   const button=document.createElement('button');button.innerHTML=`<strong>${e(user(msg.sender).name)} · ${e(title(S.conversations.find(c=>c.id===msg.conversation)))}</strong><div class="connection-result-message">${messageHTML(msg.text||msg.attachment?.name||'Attachment')}</div><small>${date(msg.created)}</small>`;
   button.onclick=()=>{panel.close();safe(()=>jump(msg.id));};target.append(button);
  }
  status.textContent=target.children.length?`${target.children.length} result${target.children.length===1?'':'s'}${more?' · More available':''}`:'No results. Try another search or filter.';
  moreButton.hidden=!more;renderEmoji(target);
 }
 async function draw(append=false){
  if(append&&loading)return;
  invalidate();
  const id=epoch,q=input.value.trim(),selected=filter;
  controller=new AbortController();loading=true;retryAppend=append;moreButton.disabled=true;
  status.textContent=append?'Loading more results…':'Searching…';
  if(!append){items=[];more=false;target.replaceChildren();}
  try{
   const data=['people','settings'].includes(selected)?{messages:[],more:false}:await api('/search?'+new URLSearchParams({q,filter:selected,...(append&&items.length?{before:String(items.at(-1).created)}:{})}),{signal:controller.signal});
   if(!valid(id))return;
   items=[...new Map([...(append?items:[]),...data.messages].map(m=>[m.id,m])).values()];more=data.more;
   paint(q,selected);
  }catch(error){
   if(!valid(id))return;
   status.textContent='Search could not load: '+error.message;retryButton.hidden=false;moreButton.hidden=true;
  }finally{
   if(valid(id)){loading=false;target.setAttribute('aria-busy','false');moreButton.disabled=false;}
  }
 }
 panel.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
  filter=button.dataset.filter;panel.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(filter===b.dataset.filter)));draw();
 });
 input.oninput=()=>{invalidate();target.replaceChildren();status.textContent='Searching…';timer=setTimeout(()=>draw(),200);};
 moreButton.onclick=()=>draw(true);retryButton.onclick=()=>draw(retryAppend);
 panel.addEventListener('close',()=>{invalidate();},{once:true});
 draw();input.focus();return panel;
}
