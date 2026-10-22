import './immersive-call.css';

let configuration={},session;const drafts=new Map();
export function configureImmersiveCall(options){configuration=options;}
export function closeImmersiveCall(){session?.close();}

export async function toggleImmersiveCall(stage){
 if(!stage?.isConnected||stage.hidden)throw Error('Join a call or open a movie first.');
 if(session&&document.fullscreenElement===session.root){await document.exitFullscreen();return;}
 session?.close();
 if(document.fullscreenElement)await document.exitFullscreen();
 const root=document.createElement('section');root.id='call-immersive';root.tabIndex=-1;root.setAttribute('aria-label','Fullscreen call');
 root.innerHTML='<video class="immersive-main" autoplay playsinline muted></video><div class="immersive-camera" aria-label="Drag participant camera" tabindex="0"><video autoplay playsinline muted></video><span></span></div><button class="immersive-exit" type="button" aria-label="Exit fullscreen">Exit fullscreen</button><aside class="immersive-chat" aria-label="Call chat" hidden><header><strong>Chat</strong><button type="button" aria-label="Close chat">Ã—</button></header><div class="immersive-messages" aria-live="polite"></div><p class="immersive-chat-error" role="status" hidden></p><form><textarea rows="1" maxlength="4000" aria-label="Message in call" placeholder="Messageâ€¦"></textarea><button type="submit">Send</button></form></aside>';
 document.body.append(root);
 const video=root.querySelector('.immersive-main'),camera=root.querySelector('.immersive-camera'),cameraVideo=camera.querySelector('video'),chat=root.querySelector('.immersive-chat'),messages=chat.querySelector('.immersive-messages'),form=chat.querySelector('form'),input=form.querySelector('textarea'),error=chat.querySelector('.immersive-chat-error'),abort=new AbortController(),captured=new Map();
 let closed=false,entered=false,source,cameraSource,timer,controlsTimer,chatBusy=false,chatSignature='',chatRevision=0,drag,dragged=false,chatConversation;
 const conversation=configuration.conversation?.();
 const play=element=>element.play().catch(()=>{});
 function bind(element,original){
  if(!original){element.pause();element.srcObject=null;element.removeAttribute('src');return;}
  let stream=original.srcObject;
  if(!stream&&original.readyState>=2&&original.captureStream){let saved=captured.get(original);if(!saved||saved.source!==original.currentSrc){saved?.stream.getTracks().forEach(t=>t.stop());saved={source:original.currentSrc,stream:original.captureStream()};captured.set(original,saved);}stream=saved.stream;}
  if(stream){if(element.srcObject!==stream){element.removeAttribute('src');element.srcObject=stream;}}
  else if(original.currentSrc&&!original.currentSrc.startsWith('blob:')){if(element.src!==original.currentSrc){element.srcObject=null;element.src=original.currentSrc;}if(Math.abs(element.currentTime-original.currentTime)>.6)element.currentTime=original.currentTime;}
  if(!original.paused)play(element);else if(!original.srcObject)element.pause();
 }
 function candidates(){
  const tiles=[...stage.querySelectorAll('.call-tile.video-enabled,#vela-movie-player')];if(stage.id==='vela-movie-player')tiles.unshift(stage);
  const ready=tiles.filter(t=>t.querySelector('video'));
  const media=ready.find(t=>t.classList.contains('focused')&&(t.classList.contains('screen-tile')||t.id==='vela-movie-player'))||ready.find(t=>t.classList.contains('screen-tile')&&t.dataset.self!=='true')||ready.find(t=>t.classList.contains('screen-tile'))||ready.find(t=>t.id==='vela-movie-player');
  const main=media||ready.find(t=>t.dataset.self!=='true')||ready[0];
  const cameras=ready.filter(t=>t!==main&&t.classList.contains('call-tile')&&!t.classList.contains('screen-tile')&&t.dataset.self!=='true');
  return {main,small:cameras.find(t=>t.dataset.participant===main?.dataset.participant)||cameras[0]};
 }
 function clampCamera(){if(!dragged)return;const r=root.getBoundingClientRect();camera.style.left=Math.max(0,Math.min(parseFloat(camera.style.left)||0,r.width-camera.offsetWidth))+'px';camera.style.top=Math.max(0,Math.min(parseFloat(camera.style.top)||0,r.height-camera.offsetHeight))+'px';camera.style.right='auto';}
 function sync(){
  if(closed)return;if(!stage.isConnected||stage.hidden||(stage.id==='call-stage'&&configuration.conversation?.()?.id!==conversation?.id)){if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});close();return;}
  const {main,small}=candidates();
  if(source!==main){source=main;video.srcObject=null;video.removeAttribute('src');}
  bind(video,main?.querySelector('video'));camera.hidden=!small;
  if(cameraSource!==small){cameraSource=small;cameraVideo.srcObject=null;cameraVideo.removeAttribute('src');}
  if(small){bind(cameraVideo,small.querySelector('video'));camera.querySelector('span').textContent=small.querySelector('.tile-label span')?.textContent||'';}
  for(const [original,saved]of captured)if(original!==main?.querySelector('video')&&original!==small?.querySelector('video')){saved.stream.getTracks().forEach(t=>t.stop());captured.delete(original);}
  clampCamera();if(!chat.hidden)refreshChat();
 }
 function reveal(){root.classList.add('show-exit');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>root.classList.remove('show-exit'),1200);}
 async function refreshChat(){
  if(chatBusy||closed||chat.hidden||!conversation?.id||!configuration.messages)return;
  if(Date.now()-(root.__chatFetch||0)<1500)return;root.__chatFetch=Date.now();chatBusy=true;const revision=++chatRevision;
  try{const items=await configuration.messages(conversation.id);if(closed||revision!==chatRevision)return;const signature=JSON.stringify(items);if(signature===chatSignature)return;chatSignature=signature;const bottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<70;messages.replaceChildren();
   for(const item of items){const article=document.createElement('article'),author=document.createElement('strong'),text=document.createElement('p');author.textContent=item.name||'Participant';text.textContent=item.text||item.attachment?.name||'';article.append(author,text);messages.append(article);}
   if(bottom)messages.scrollTop=messages.scrollHeight;
  }catch(reason){if(!closed){error.hidden=false;error.textContent=reason.message;}}finally{chatBusy=false;}
 }
 function toggleChat(){chat.hidden=!chat.hidden;if(!chat.hidden){chatConversation=conversation?.id;chat.querySelector('strong').textContent=conversation?.name||'Chat';input.value=drafts.get(chatConversation)||'';input.disabled=!chatConversation;form.querySelector('button').disabled=!chatConversation;if(!chatConversation){error.hidden=false;error.textContent='Open a conversation to chat.';}root.__chatFetch=0;refreshChat();input.focus();}else root.focus({preventScroll:true});}
 let draftRequest;input.oninput=()=>drafts.set(conversation?.id,input.value);
 form.onsubmit=async event=>{event.preventDefault();const text=input.value.trim();if(!text||!chatConversation||!configuration.send)return;const submit=form.querySelector('button');submit.disabled=true;error.hidden=true;try{if(!draftRequest||draftRequest.text!==text)draftRequest={text,id:crypto.randomUUID()};await configuration.send(chatConversation,text,draftRequest.id);if(closed)return;input.value='';drafts.delete(chatConversation);draftRequest=null;root.__chatFetch=0;await refreshChat();}catch(reason){if(!closed){error.hidden=false;error.textContent=reason.message;}}finally{if(!closed){submit.disabled=false;input.focus();}}};
 input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();event.stopPropagation();form.requestSubmit();}};
 chat.querySelector('[aria-label="Close chat"]').onclick=()=>{chat.hidden=true;root.focus({preventScroll:true});};
 root.querySelector('.immersive-exit').onclick=()=>document.exitFullscreen().catch(()=>{});
 root.addEventListener('pointermove',reveal,{signal:abort.signal});
 camera.addEventListener('pointerdown',event=>{if(event.button!==0)return;const r=camera.getBoundingClientRect(),s=root.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:r.left-s.left,top:r.top-s.top};camera.setPointerCapture(event.pointerId);event.preventDefault();},{signal:abort.signal});
 camera.addEventListener('pointermove',event=>{if(!drag)return;dragged=true;camera.style.left=drag.left+event.clientX-drag.x+'px';camera.style.top=drag.top+event.clientY-drag.y+'px';camera.style.right='auto';clampCamera();event.stopPropagation();},{signal:abort.signal});
 const endDrag=()=>{drag=null;};camera.addEventListener('pointerup',endDrag,{signal:abort.signal});camera.addEventListener('pointercancel',endDrag,{signal:abort.signal});
 camera.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const r=camera.getBoundingClientRect(),s=root.getBoundingClientRect(),step=event.shiftKey?40:10;dragged=true;camera.style.left=r.left-s.left+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0)+'px';camera.style.top=r.top-s.top+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)+'px';clampCamera();},{signal:abort.signal});
 document.addEventListener('keydown',event=>{if(document.fullscreenElement!==root||event.repeat||event.isComposing)return;if(event.key==='Enter'&&!event.target.closest?.('textarea,input,button,[contenteditable=true]')){event.preventDefault();event.stopImmediatePropagation();toggleChat();}},{capture:true,signal:abort.signal});
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===root)entered=true;else if(entered)close();},{signal:abort.signal});
 window.addEventListener('resize',clampCamera,{signal:abort.signal});
 function close(){if(closed)return;if(conversation?.id&&input.value)drafts.set(conversation.id,input.value);closed=true;clearInterval(timer);clearTimeout(controlsTimer);abort.abort();for(const saved of captured.values())saved.stream.getTracks().forEach(t=>t.stop());for(const element of [video,cameraVideo]){element.pause();element.srcObject=null;element.removeAttribute('src');element.load();}root.remove();if(session?.root===root)session=null;}
 session={root,close};sync();if(closed)throw Error('This call is no longer active.');timer=setInterval(sync,300);
 try{await root.requestFullscreen({navigationUI:'hide'});entered=true;root.focus({preventScroll:true});}catch(reason){close();throw reason;}
}
