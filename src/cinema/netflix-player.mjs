import {escape as e} from '../util.js';
import './netflix-player.css';

export const netflixSources=Object.freeze([
 {id:'cinesrc',name:'CineSrc',origin:'https://cinesrc.st'},
 {id:'yapgrid',name:'YapGrid',origin:'https://yapgrid.com'}
]);
export function normalizeTitle(value){
 const id=Number(value?.tmdbId||value?.id);if(!Number.isSafeInteger(id)||id<1)throw Error('This title is unavailable. Choose another title.');
 return {...value,id,type:value.type==='tv'?'tv':'movie',season:Math.max(1,Math.floor(Number(value.season)||1)),episode:Math.max(1,Math.floor(Number(value.episode)||1))};
}
export function netflixSourceURL(source,item){
 const path=source.id==='cinesrc'?(item.type==='tv'?`/embed/tv/${item.id}?s=${item.season}&e=${item.episode}`:`/embed/movie/${item.id}`):(item.type==='tv'?`/embed/tv/${item.id}/${item.season}/${item.episode}`:`/embed/movie/${item.id}`);
 const url=new URL(path,source.origin);url.searchParams.set('autoplay',source.id==='cinesrc'?'true':'1');
 if(source.id==='cinesrc'){url.searchParams.set('controls','true');url.searchParams.set('color','#e50914');url.searchParams.set('back','close');url.searchParams.set('autonext','false');}
 return url.href;
}
const fullscreen='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
const collapse='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8h5V3m13 5h-5V3M3 16h5v5m13-5h-5v5"/></svg>';
export class NetflixPlayer{
 constructor({prefix,onProgress=()=>{},onClose=()=>{},onState=()=>{}}){
  Object.assign(this,{prefix,onProgress,onClose,onState});this.available=netflixSources;this.dialog=null;this.frame=null;this.item=null;this.provider=netflixSources[0];this.state={position:0,duration:0,playing:false};this.listeners=null;this.partyInfo=null;this.lastSave=0;this.ready=false;this.pendingSeek=null;
 }
 get mediaKey(){return `${this.prefix}.progress.${this.item.type}.${this.item.id}.${this.item.type==='tv'?this.item.season+'.'+this.item.episode:'film'}`}
 readProgress(){try{return JSON.parse(localStorage.getItem(this.mediaKey)||'null')}catch{return null}}
 open(value,{source='cinesrc',position}={}){
  this.close();this.item=normalizeTitle(value);this.provider=this.available.find(p=>p.id===source)||this.available[0];this.partyInfo=null;
  const dialog=this.dialog=document.createElement('dialog');dialog.className='np-player';dialog.setAttribute('aria-label',this.item.title+' player');
  dialog.innerHTML=`<header class="np-heading"><button data-player-close aria-label="Back to browsing" title="Back to browsing">←</button><div class="np-title"><strong></strong><span data-player-episode></span></div><label class="np-source-label"><span>Source</span><select data-source aria-label="Streaming source">${this.available.map(p=>`<option value="${p.id}">${p.name}${p.id==='yapgrid'?' · Alternative':''}</option>`).join('')}</select></label><button data-player-retry aria-label="Reload player" title="Reload player">↻</button><button data-player-chat hidden aria-label="Hide watch party chat" aria-expanded="true">Chat</button><button data-fullscreen aria-label="Enter fullscreen" title="Enter fullscreen">${fullscreen}</button><button data-player-close aria-label="Close player" title="Close player">×</button></header><main class="np-body"><section class="np-video"><iframe title="${e(this.item.title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"></iframe></section><aside class="np-party" hidden></aside></main><footer class="np-footer"><div class="np-episode-buttons"><button data-previous hidden>← Previous episode</button><button data-next hidden>Next episode →</button></div><p data-player-feedback role="status" hidden></p><button data-player-alternate hidden>Try YapGrid</button></footer>`;
  document.body.append(dialog);this.frame=dialog.querySelector('iframe');this.listeners=new AbortController();const listen={signal:this.listeners.signal};
  dialog.querySelectorAll('[data-player-close]').forEach(button=>button.onclick=()=>this.close());dialog.querySelector('[data-player-retry]').onclick=()=>this.load();dialog.querySelector('[data-source]').onchange=event=>this.switchSource(event.target.value);dialog.querySelector('[data-player-alternate]').onclick=()=>this.switchSource(this.provider.id==='cinesrc'?'yapgrid':'cinesrc');
  dialog.querySelector('[data-previous]').onclick=()=>this.changeEpisode(-1);dialog.querySelector('[data-next]').onclick=()=>this.changeEpisode(1);dialog.querySelector('[data-fullscreen]').onclick=()=>this.toggleFullscreen();
  dialog.querySelector('[data-player-chat]').onclick=()=>{const pane=dialog.querySelector('.np-party'),hidden=!pane.hidden;pane.hidden=hidden;dialog.classList.toggle('np-chat-hidden',hidden);this.updateChatButton();};
  window.addEventListener('message',event=>this.receive(event),listen);document.addEventListener('fullscreenchange',()=>this.fullscreenChanged(),listen);
  dialog.addEventListener('cancel',event=>{if(document.fullscreenElement){event.preventDefault();document.exitFullscreen().catch(()=>{});}else if(performance.now()-(this.fullscreenExitAt||0)<500)event.preventDefault();});
  dialog.addEventListener('close',()=>this.cleanup(dialog),{once:true});
  document.addEventListener('keydown',event=>{if(!dialog.open||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea,[contenteditable]'))return;if(event.key.toLowerCase()==='f'){event.preventDefault();this.toggleFullscreen();}},listen);
  this.frame.addEventListener('load',()=>{if(this.provider.id==='cinesrc')this.requestStatus();},listen);this.frame.addEventListener('error',()=>this.feedback('This source could not load. Try reloading or use the alternative source.',true),listen);
  dialog.showModal();this.load(position);this.poll=setInterval(()=>this.requestStatus(),2500);dialog.querySelector('[data-player-close]').focus();return this;
 }
 load(position){
  if(!this.dialog)return;this.persist(true);clearTimeout(this.loadTimer);this.ready=false;const saved=Number.isFinite(position)?position:this.readProgress()?.position||0;this.pendingSeek=saved>0?saved:null;this.state={position:saved,duration:0,playing:false};this.lastSave=0;
  this.paintTitle();this.dialog.querySelector('[data-source]').value=this.provider.id;this.feedback('');this.frame.title=this.provider.name+' · '+this.item.title;this.frame.src=netflixSourceURL(this.provider,this.item);
  if(this.provider.id==='cinesrc')this.loadTimer=setTimeout(()=>{if(this.dialog&&!this.ready)this.feedback('Still loading? Reload this source or try YapGrid.',true)},25000);
 }
 switchSource(id){if(this.partyInfo)return;const source=this.available.find(p=>p.id===id);if(!source||source===this.provider)return;this.persist(true);const position=this.state.position;this.provider=source;this.load(position);this.onState({...this.state,type:'sourcechange'});}
 paintTitle(){if(!this.dialog)return;this.dialog.querySelector('.np-title strong').textContent=this.item.title;this.dialog.querySelector('[data-player-episode]').textContent=this.item.type==='tv'?`Season ${this.item.season} · Episode ${this.item.episode}`:'';this.updateEpisodeButtons();}
 updateEpisodeButtons(){if(!this.dialog)return;const isTV=this.item.type==='tv',guest=this.partyInfo&&!this.partyInfo.host,count=Number(this.item.seasonEpisodeCount);for(const selector of ['[data-previous]','[data-next]'])this.dialog.querySelector(selector).hidden=!isTV;this.dialog.querySelector('[data-previous]').disabled=!!guest||this.item.episode<=1;this.dialog.querySelector('[data-next]').disabled=!!guest||(count>0&&this.item.episode>=count);this.updateFooter();}
 changeEpisode(offset){const episode=this.item.episode+offset,count=Number(this.item.seasonEpisodeCount);if(this.partyInfo&&!this.partyInfo.host||episode<1||count>0&&episode>count)return;this.persist(true);this.item={...this.item,episode};this.state={position:0,duration:0,playing:false};this.load(0);this.onState({...this.state,type:'episodechange'});}
 async toggleFullscreen(){
  const dialog=this.dialog;if(!dialog)return;try{if(document.fullscreenElement&&(document.fullscreenElement===dialog||dialog.contains(document.fullscreenElement))){await document.exitFullscreen();if(this.dialog!==dialog)return;}else if(dialog.requestFullscreen)await dialog.requestFullscreen();else this.feedback('Use the fullscreen control inside the video player.');}catch{this.feedback('Fullscreen was blocked. Use the fullscreen control inside the video player.');}
 }
 fullscreenChanged(){if(!this.dialog)return;const active=document.fullscreenElement===this.dialog||!!document.fullscreenElement&&this.dialog.contains(document.fullscreenElement),button=this.dialog.querySelector('[data-fullscreen]');button.innerHTML=active?collapse:fullscreen;button.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');button.title=active?'Exit fullscreen':'Enter fullscreen';if(!document.fullscreenElement)this.fullscreenExitAt=performance.now();}
 feedback(text,error=false){if(!this.dialog)return;const node=this.dialog.querySelector('[data-player-feedback]');node.textContent=text;node.hidden=!text;node.classList.toggle('np-error',error);this.dialog.querySelector('[data-player-alternate]').hidden=!error||!!this.partyInfo;this.dialog.querySelector('[data-player-alternate]').textContent=this.provider.id==='cinesrc'?'Try YapGrid':'Try CineSrc';this.updateFooter();}
 updateFooter(){if(!this.dialog)return;this.dialog.querySelector('.np-footer').hidden=this.item.type!=='tv'&&this.dialog.querySelector('[data-player-feedback]').hidden;}
 command(command,value){if(this.provider.id!=='cinesrc')return;this.frame?.contentWindow?.postMessage({type:'cinesrc:command',command:({volume:'setVolume',speed:'setPlaybackRate'})[command]||command,args:value===undefined?[]:[value]},this.provider.origin);}
 requestStatus(){if(!this.dialog||this.provider.id!=='cinesrc')return;for(const command of ['getCurrentTime','getDuration','getPaused'])this.command(command);}
 receive(event){
  if(!this.dialog||!this.frame||event.source!==this.frame.contentWindow||event.origin!==this.provider.origin||this.provider.id!=='cinesrc')return;let data=event.data;if(typeof data==='string'){try{data=JSON.parse(data)}catch{return}}if(!data||typeof data!=='object'||typeof data.type!=='string'||!data.type.startsWith('cinesrc:'))return;
  let type=data.type.slice(8),position=data.currentTime,duration=data.duration,playing;
  if(type==='close'){this.close();return;}if(type==='error'){this.feedback('This stream reported an error. Reload it or try the alternative source.',true);return;}
  if(type==='play')playing=true;if(['pause','ended'].includes(type))playing=false;
  if(type==='response'){if(data.command==='getCurrentTime')position=data.result;if(data.command==='getDuration')duration=data.result;if(data.command==='getPaused'&&typeof data.result==='boolean')playing=!data.result;}
  if(type==='nextepisode'&&Number.isSafeInteger(data.episode)&&data.episode>0){this.persist(true);this.item={...this.item,season:Number(data.season)||this.item.season,episode:data.episode};this.state={position:0,duration:0,playing:false};this.paintTitle();type='episodechange';if(!data.internalNavigation)this.load(0);}
  if(Number.isFinite(position)&&position>=0&&position<86400)this.state.position=position;if(Number.isFinite(duration)&&duration>0&&duration<86400)this.state.duration=duration;if(typeof playing==='boolean')this.state.playing=playing;
  if(['ready','loadedmetadata','play','timeupdate'].includes(type)){this.ready=true;clearTimeout(this.loadTimer);this.feedback('');}
  if(this.pendingSeek!==null&&this.state.duration>0){const seek=Math.min(this.pendingSeek,Math.max(0,this.state.duration-1));this.pendingSeek=null;this.command('seek',seek);}
  this.onState({...this.state,type});this.persist(['pause','ended','seeked'].includes(type));
 }
 persist(force=false){if(!this.item||this.state.duration<=0||this.state.position<1||!force&&Date.now()-this.lastSave<10000)return;this.lastSave=Date.now();try{localStorage.setItem(this.mediaKey,JSON.stringify({...this.state,at:Date.now()}))}catch{}this.onProgress(this.item,{currentTime:this.state.position,duration:this.state.duration,playing:this.state.playing},force);}
 setParty(info){
  this.partyInfo=info;if(!this.dialog)return;this.dialog.classList.toggle('np-has-party',!!info);const pane=this.dialog.querySelector('.np-party');pane.hidden=!info;if(!info){pane.replaceChildren();this.dialog.classList.remove('np-chat-hidden');}this.dialog.querySelector('[data-source]').disabled=!!info;this.dialog.querySelector('[data-player-chat]').hidden=!info;this.updateEpisodeButtons();this.updateChatButton();return pane;
 }
 updateChatButton(){if(!this.dialog)return;const button=this.dialog.querySelector('[data-player-chat]'),expanded=!this.dialog.querySelector('.np-party').hidden;button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-label',expanded?'Hide watch party chat':'Show watch party chat');}
 close(){const dialog=this.dialog;if(!dialog)return;if(document.fullscreenElement&&(document.fullscreenElement===dialog||dialog.contains(document.fullscreenElement)))document.exitFullscreen().catch(()=>{});this.cleanup(dialog);if(dialog.open)dialog.close();dialog.remove();}
 cleanup(dialog){if(this.dialog!==dialog)return;this.persist(true);clearInterval(this.poll);clearTimeout(this.loadTimer);this.listeners?.abort();this.frame?.removeAttribute('src');this.frame=null;this.dialog=null;this.partyInfo=null;dialog.remove();this.onClose(this.item);}
}
