import {socialLink} from './social-links.mjs';
import {escape as e} from './util.js';
import './social.css';

export function createSocial({S,api,modal,toast,title,user,openChat,send,chatWith}) {
 const pendingKey='vela.social.pending';
 let shared='';
 const incoming=new URL(location.href);
 for(const name of ['share','tiktok','url','text','title']) {const value=incoming.searchParams.get(name);if(socialLink(value))shared=value;}
 if(shared){try{sessionStorage.setItem(pendingKey,shared);}catch{}for(const name of ['share','tiktok','url','text','title'])incoming.searchParams.delete(name);history.replaceState(history.state,'',incoming.pathname+incoming.search+incoming.hash);}
 function clearPending(){shared='';try{sessionStorage.removeItem(pendingKey);}catch{}}
 function card(post) {
  const node=document.createElement('section');node.className='social-post';node.dataset.socialUrl=post.url;
  node.innerHTML=`<header><strong>${e(post.label)}</strong><a href="${e(post.url)}" target="_blank" rel="noopener noreferrer">Open original ↗</a></header><div class="social-player"><button type="button" data-load-post><span class="social-play">▶</span><strong>Watch ${e(post.label)}</strong><small>Play here in VELA</small></button></div><p class="social-note">Public posts play here when the creator allows embeds.</p><footer><button type="button" data-forward-post>Send to a friend</button><button type="button" data-copy-post>Copy link</button></footer>`;
  node.querySelector('[data-forward-post]').onclick=()=>compose(post.url);
  node.querySelector('[data-copy-post]').onclick=async()=>{try{await navigator.clipboard.writeText(post.url);toast('Post link copied.');}catch{toast('Press and hold the original link to copy it.');}};
  node.querySelector('[data-load-post]').onclick=async event=>{
   const button=event.currentTarget;button.disabled=true;button.querySelector('strong').textContent='Loading post…';
   try {
    if(!post.embed)post=(await api('/social/resolve',{method:'POST',body:{url:post.url}})).post;
    if(!node.isConnected)return;
    const iframe=document.createElement('iframe');iframe.title=post.label+' post player';iframe.src=post.embed;iframe.allow='fullscreen; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';
    node.querySelector('.social-player').replaceChildren(iframe);
    node.querySelector('.social-note').textContent='If the post is unavailable or asks for login, use Open original. You can also share a video file you have permission to upload.';
   }catch(error){button.disabled=false;button.querySelector('strong').textContent='Try loading again';node.querySelector('.social-note').textContent=error.message;}
  };
  return node;
 }
 function enhance(target=document) {
  for(const text of target.querySelectorAll('#messages .message-text,.pin-row p,.saved-message-text')) {
   if(text.querySelector('.social-post')||text.closest('.editing-message'))continue;
   const post=socialLink(text.textContent);if(post)text.append(card(post));
  }
 }
 function render(target,html) {
  const template=document.createElement('template');template.innerHTML=html;
  const preserved=new Map();
  for(const old of target.querySelectorAll(':scope > .message[data-message]')) {
   if(!old.querySelector('.social-post iframe'))continue;
   const fresh=[...template.content.querySelectorAll('.message[data-message]')].find(n=>n.dataset.message===old.dataset.message);
   if(!fresh)continue;
   const before=old.querySelector('.message-text').cloneNode(true);before.querySelectorAll('.social-post').forEach(n=>n.remove());
   if(before.innerHTML!==fresh.querySelector('.message-text').innerHTML)continue;
   old.className=fresh.className;
   for(const selector of ['.reactions','.message-toolbar','.message-heading']){const a=old.querySelector(selector),b=fresh.querySelector(selector);if(a&&b)a.innerHTML=b.innerHTML;}
   preserved.set(old.dataset.message,old);
  }
  // Keep active iframe ancestors attached. Removing/reinserting an iframe restarts playback.
  for(const child of [...target.children])if(![...preserved.values()].includes(child))child.remove();
  let anchor=target.firstChild;
  for(const fresh of [...template.content.children]){const old=preserved.get(fresh.dataset.message);if(old){anchor=old.nextSibling;}else target.insertBefore(fresh,anchor);}
 }
 function compose(initial='') {
  if(!S.user)return;
  const owner=S.user.uid,dialog=modal('Share Post',`<div class="social-intro"><strong>Something they need to see.</strong><p>On your iPhone: TikTok → Share → Copy Link. Paste it here and send it to a friend.</p></div><label>POST LINK<div class="social-link-input"><input name="post" aria-label="Post link" type="text" inputmode="url" autocapitalize="none" autocomplete="off" placeholder="Paste a TikTok or Instagram link" value="${e(initial)}"><button type="button" data-paste>Paste</button></div></label><p class="social-validation" role="status"></p><label>ADD A MESSAGE<textarea name="note" aria-label="Optional message" maxlength="2000" placeholder="Thought of you…" rows="2"></textarea></label><label>SEND TO<input type="search" aria-label="Search friends and groups" placeholder="Search friends and groups"></label><div class="social-recipients"></div><p class="form-error" role="alert"></p><footer><small>Only the people you choose receive this post.</small><button type="button" class="primary" data-send-post disabled>Send Post</button></footer>`,{onclose:clearPending});
  dialog.classList.add('social-compose');
  const input=dialog.querySelector('[name=post]'),status=dialog.querySelector('.social-validation'),list=dialog.querySelector('.social-recipients'),submit=dialog.querySelector('[data-send-post]'),error=dialog.querySelector('.form-error');
  let selected=null,busy=false;
  const destinations=S.conversations.map(c=>({id:c.id,name:title(c),detail:c.kind==='group'?c.members.length+' members':'@'+(c.members.find(m=>m.uid!==S.user.uid)?.handle||''),search:c.members.map(m=>m.name+' '+m.handle).join(' ')}));
  for(const friend of S.friends.filter(f=>f.status==='accepted'&&!S.conversations.some(c=>c.kind==='direct'&&c.members.some(m=>m.uid===f.uid))))destinations.push({id:'friend:'+friend.uid,name:friend.name,detail:'@'+friend.handle,friend:friend.uid});
  function validate(){const post=socialLink(input.value);status.textContent=post?post.label+' · Ready to share':input.value?'Use a TikTok post, Instagram post, or Reel link.':'TikTok short links and Instagram Reels are supported.';submit.disabled=busy||!post||!selected;return post;}
  function recipients(query=''){const found=destinations.filter(c=>(c.name+' '+c.detail+' '+(c.search||'')).toLowerCase().includes(query.toLowerCase()));list.innerHTML=found.map(c=>`<button type="button" class="social-recipient ${selected?.id===c.id?'selected':''}" data-destination="${e(c.id)}" aria-pressed="${selected?.id===c.id}"><span class="social-initial">${e(c.name.slice(0,2).toUpperCase())}</span><span><strong>${e(c.name)}</strong><small>${e(c.detail)}</small></span><span class="social-check">${selected?.id===c.id?'✓':''}</span></button>`).join('')||'<p class="muted">'+(destinations.length?'No matching friends or groups.':'Add a friend in VELA first, then share a post here.')+'</p>';list.querySelectorAll('[data-destination]').forEach(button=>button.onclick=()=>{selected=destinations.find(c=>c.id===button.dataset.destination);recipients(dialog.querySelector('[type=search]').value);validate();});}
  dialog.querySelector('[type=search]').oninput=event=>recipients(event.target.value);input.oninput=()=>{error.textContent='';validate();};
  dialog.querySelector('[data-paste]').onclick=async()=>{try{input.value=await navigator.clipboard.readText();validate();}catch{status.textContent='Press and hold the link field, then tap Paste.';input.focus();}};
  submit.onclick=async()=>{
   let post=validate();if(!post||!selected||busy)return;if(S.user?.uid!==owner){error.textContent='Your account changed. Reopen Share Post.';return;}
   busy=true;validate();submit.textContent='Sending…';error.textContent='';dialog.querySelectorAll('input,textarea,[data-destination],[data-paste]').forEach(el=>el.disabled=true);
   try{
    // Resolving is an enhancement: a blocked short link must never prevent sending.
    if(!post.id)try{post=(await api('/social/resolve',{method:'POST',body:{url:post.url}})).post;}catch{}
    if(S.user?.uid!==owner)throw Error('Your account changed. Reopen Share Post.');
    const cid=selected.friend?(await chatWith(selected.friend)).id:selected.id;
    const note=dialog.querySelector('[name=note]').value.trim();
    await send(cid,(note?note+'\n':'')+post.url,owner);
    dialog.close();
   }catch(err){error.textContent=err.message;busy=false;submit.textContent='Send Post';dialog.querySelectorAll('input,textarea,[data-destination],[data-paste]').forEach(el=>el.disabled=false);validate();}
  };
  recipients();validate();
 }
 async function shelf() {
  const owner=S.user?.uid,dialog=modal('Shared Posts',`<div class="social-shelf-top"><p>TikToks and Reels from your conversations.</p><button type="button" data-new-post class="primary">Share Post</button></div><div class="social-filters"><label>Platform<select name="provider"><option value="">All posts</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></label><label>Conversation<select name="conversation"><option value="">All conversations</option>${S.conversations.map(c=>`<option value="${e(c.id)}">${e(title(c))}</option>`).join('')}</select></label></div><div class="social-shelf" aria-live="polite"></div><p class="form-error" role="alert"></p><footer><button type="button" data-more-posts>Load more</button></footer>`,{wide:true});
  dialog.classList.add('social-shelf-modal');let items=[],cursor=null,loading=false,revision=0;
  const target=dialog.querySelector('.social-shelf'),more=dialog.querySelector('[data-more-posts]'),error=dialog.querySelector('.form-error');
  function draw(){target.replaceChildren();const provider=dialog.querySelector('[name=provider]').value,visible=items.filter(m=>!provider||m.post.provider===provider);for(const m of visible){const item=document.createElement('article');item.className='social-shelf-item';const conversation=S.conversations.find(c=>c.id===m.conversation);item.innerHTML=`<div class="social-shelf-byline"><strong>${e(user(m.sender).name)}</strong><small>${e(new Date(m.created).toLocaleDateString())} · ${e(conversation?title(conversation):'Conversation')}</small></div><p class="social-caption">${e(m.text.replace(/https:\/\/\S+/g,'').trim())}</p>`;item.append(card(m.post));const jump=document.createElement('button');jump.type='button';jump.className='text-button';jump.textContent='Open conversation';jump.onclick=()=>{dialog.close();openChat(m.conversation);};item.append(jump);target.append(item);}if(!visible.length)target.innerHTML='<div class="social-empty"><strong>No shared posts yet</strong><p>Send a TikTok or Reel to a friend. It will be waiting here.</p></div>';more.hidden=!cursor;}
  async function load(reset=false){if(loading&&!reset)return;const current=++revision;loading=true;more.disabled=true;error.textContent='';if(reset){items=[];cursor=null;target.textContent='Loading posts…';}try{const query=new URLSearchParams();if(cursor&&!reset){query.set('before',cursor.before);query.set('id',cursor.id);}const cid=dialog.querySelector('[name=conversation]').value;if(cid)query.set('conversation',cid);const data=await api('/social/posts?'+query);if(current!==revision||!dialog.isConnected||S.user?.uid!==owner)return;items.push(...data.posts);cursor=data.next;draw();}catch(err){if(current===revision){error.textContent=err.message;more.hidden=false;more.textContent='Retry';}}finally{if(current===revision){loading=false;more.disabled=false;}}}
  dialog.querySelector('[data-new-post]').onclick=()=>{dialog.close();compose();};dialog.querySelector('[name=provider]').onchange=draw;dialog.querySelector('[name=conversation]').onchange=()=>load(true);more.onclick=()=>load();await load(true);
 }
 function ready(){try{shared=shared||sessionStorage.getItem(pendingKey)||'';}catch{}if(shared&&socialLink(shared)&&!document.querySelector('.social-compose'))compose(shared);else if(incoming.searchParams.get('open')==='share')compose();}
 document.addEventListener('click',event=>{if(event.target.closest('[data-social-compose]'))compose();if(event.target.closest('[data-social-shelf]'))shelf().catch(error=>toast(error.message));});
 return {enhance,render,compose,shelf,ready};
}
