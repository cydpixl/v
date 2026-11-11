import {icon} from './icons.js';
import {escape as e} from './util.js';

// Capture a small private JPEG preview before upload. Unsupported codecs fail safely.
export async function makeChatVideoPoster(file) {
 if (!file?.type?.startsWith('video/')) return '';
 const url=URL.createObjectURL(file),video=document.createElement('video');
 video.muted=true;video.playsInline=true;video.preload='auto';
 video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
 video.src=url;
 try {
  const ready=await new Promise(resolve=>{
   let settled=false;
   const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
   const timer=setTimeout(()=>finish(video.readyState>=2),4200);
   video.addEventListener('error',()=>finish(false),{once:true});
   video.addEventListener('loadedmetadata',()=>{
    const duration=video.duration;
    if(Number.isFinite(duration)&&duration>0.4){
     try{video.currentTime=Math.min(1,Math.max(.1,duration*.18));}catch{}
    }
   },{once:true});
   video.addEventListener('seeked',()=>finish(true),{once:true});
   video.addEventListener('loadeddata',()=>{if(video.readyState>=2)finish(true);},{once:true});
   video.load();
  });
  if(!ready||!video.videoWidth||!video.videoHeight)return '';
  const scale=Math.min(1,300/video.videoWidth,170/video.videoHeight);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
  canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,canvas.width,canvas.height);
  for(const quality of [.68,.52,.38]){
   const poster=canvas.toDataURL('image/jpeg',quality);
   if(poster.length<=20000)return poster;
  }
  return '';
 } catch {return '';}
 finally {video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

export function renderChatVideo(file,src) {
 const poster=typeof file.poster==='string'&&file.poster.startsWith('data:image/jpeg;base64,')?file.poster:'';
 const label=e(file.name||'Video');
 return '<div class="vela-video-card"><button type="button" class="vela-video-launch" aria-label="Play '+label+'">'+
 '<video class="vela-video-thumb" playsinline muted preload="'+(poster?'none':'metadata')+'" aria-hidden="true" tabindex="-1"'+
 (poster?' poster="'+e(poster)+'"':'')+' src="'+e(src)+'"></video>'+
 '<span class="vela-video-play" aria-hidden="true">'+icon('play',25)+'</span>'+
 '<span class="vela-video-foot">'+icon('video',14)+'<span>'+label+'</span></span>'+
 '</button></div>';
}

const timeLabel=seconds=>{
 if(!Number.isFinite(seconds)||seconds<0)return '0:00';
 const n=Math.floor(seconds);return Math.floor(n/3600)?Math.floor(n/3600)+':'+String(Math.floor(n%3600/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'):Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
};

export function installChatVideoViewer() {
 if(document.getElementById('vela-video-viewer'))return;
 const dialog=document.createElement('dialog');dialog.id='vela-video-viewer';dialog.className='vela-video-viewer';
 dialog.setAttribute('aria-label','Video player');
 dialog.innerHTML='<div class="vela-video-shell">'+
 '<header class="vela-video-top"><strong data-vv-title>Video</strong><div class="vela-video-top-actions">'+
 '<a data-vv-open target="_blank" rel="noopener" aria-label="Open video in browser" title="Open video">'+icon('arrow',20)+'</a>'+
 '<button type="button" data-vv-close aria-label="Close video">'+icon('close',22)+'</button></div></header>'+
 '<div class="vela-video-stage"><video playsinline webkit-playsinline preload="metadata" aria-label="Video playback"></video>'+
 '<button class="vela-video-center" type="button" data-vv-center aria-label="Play video">'+icon('play',34)+'</button>'+
 '<div class="vela-video-error" data-vv-error hidden>Unable to play this video on this device. Try Open video.</div></div>'+
 '<div class="vela-video-bottom"><div class="vela-video-seekline">'+
 '<span data-vv-current>0:00</span><input data-vv-seek type="range" min="0" max="1000" value="0" step="1" aria-label="Seek video">'+
 '<span data-vv-total>0:00</span></div>'+
 '<div class="vela-video-actions">'+
 '<div class="vela-video-transport"><button type="button" data-vv-back aria-label="Back 10 seconds" title="Back 10 seconds">'+icon('previous',22)+'<small>10</small></button>'+
 '<button type="button" data-vv-play aria-label="Play video">'+icon('play',24)+'</button>'+
 '<button type="button" data-vv-forward aria-label="Forward 10 seconds" title="Forward 10 seconds">'+icon('next',22)+'<small>10</small></button></div>'+
 '<div class="vela-video-secondary"><button type="button" data-vv-mute aria-label="Mute video">'+icon('volume',21)+'</button>'+
 '<button type="button" data-vv-rate aria-label="Playback speed">1×</button>'+
 '<button type="button" data-vv-fullscreen aria-label="Fullscreen video">'+icon('maximize',21)+'</button></div></div></div></div>';
 document.body.append(dialog);
 const player=dialog.querySelector('.vela-video-stage video');
 const playButton=dialog.querySelector('[data-vv-play]');
 const center=dialog.querySelector('[data-vv-center]');
 const muteButton=dialog.querySelector('[data-vv-mute]');
 const seek=dialog.querySelector('[data-vv-seek]');
 const current=dialog.querySelector('[data-vv-current]');
 const total=dialog.querySelector('[data-vv-total]');
 const error=dialog.querySelector('[data-vv-error]');
 const rate=dialog.querySelector('[data-vv-rate]');
 let lastTrigger=null;
 const refresh=()=>{
  const paused=player.paused||player.ended;
  playButton.innerHTML=icon(paused?'play':'pause',24);
  playButton.setAttribute('aria-label',paused?'Play video':'Pause video');
  center.innerHTML=icon('play',34);center.hidden=!paused;
  muteButton.innerHTML=icon(player.muted?'volumeOff':'volume',21);
  muteButton.setAttribute('aria-label',player.muted?'Unmute video':'Mute video');
  const duration=Number.isFinite(player.duration)?player.duration:0;
  seek.value=String(duration?Math.round(player.currentTime/duration*1000):0);
  seek.style.setProperty('--vv-progress',(Number(seek.value)/10)+'%');
  seek.disabled=!duration;
  current.textContent=timeLabel(player.currentTime);
  total.textContent=timeLabel(duration);
 };
 async function toggle(){
  if(player.paused||player.ended){error.hidden=true;try{await player.play();}catch{error.hidden=false;}}
  else player.pause();
  refresh();
 }
 const stop=()=>{
  player.pause();player.removeAttribute('src');player.removeAttribute('poster');player.load();
  dialog.classList.remove('vela-video-fallback-fullscreen');
  document.body.classList.remove('vela-video-open');
  if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});
  lastTrigger?.focus?.({preventScroll:true});lastTrigger=null;
 };
 dialog.addEventListener('close',stop);
 dialog.addEventListener('cancel',()=>player.pause());
 dialog.querySelector('[data-vv-close]').addEventListener('click',()=>dialog.close());
 playButton.addEventListener('click',toggle);
 center.addEventListener('click',toggle);
 player.addEventListener('click',toggle);
 player.addEventListener('play',refresh);player.addEventListener('pause',refresh);
 player.addEventListener('timeupdate',refresh);player.addEventListener('loadedmetadata',refresh);
 player.addEventListener('durationchange',refresh);player.addEventListener('ended',refresh);
 player.addEventListener('error',()=>{error.hidden=false;refresh();});
 seek.addEventListener('input',()=>{
  if(Number.isFinite(player.duration)&&player.duration>0)player.currentTime=Number(seek.value)/1000*player.duration;
  refresh();
 });
 dialog.querySelector('[data-vv-back]').addEventListener('click',()=>{player.currentTime=Math.max(0,player.currentTime-10);});
 dialog.querySelector('[data-vv-forward]').addEventListener('click',()=>{if(Number.isFinite(player.duration))player.currentTime=Math.min(player.duration,player.currentTime+10);});
 muteButton.addEventListener('click',()=>{player.muted=!player.muted;refresh();});
 rate.addEventListener('click',()=>{
  const options=[1,1.25,1.5,2],index=options.indexOf(player.playbackRate);
  player.playbackRate=options[(index+1)%options.length];
  rate.textContent=player.playbackRate+'×';
 });
 dialog.querySelector('[data-vv-fullscreen]').addEventListener('click',async()=>{
  // iPhone Safari exposes fullscreen on the video element rather than arbitrary elements.
  if(typeof player.webkitEnterFullscreen==='function'){
   try{player.webkitEnterFullscreen();return;}catch{}
  }
  if(document.fullscreenElement===dialog){await document.exitFullscreen().catch(()=>{});return;}
  if(dialog.requestFullscreen){try{await dialog.requestFullscreen();return;}catch{}}
  dialog.classList.toggle('vela-video-fallback-fullscreen');
 });
 document.addEventListener('loadedmetadata',event=>{
  const thumbnail=event.target;
  if(!thumbnail.matches?.('video.vela-video-thumb')||thumbnail.hasAttribute('poster'))return;
  // Seeking a fraction into older clips encourages a visible first frame where supported.
  if(Number.isFinite(thumbnail.duration)&&thumbnail.duration>0.4){try{thumbnail.currentTime=Math.min(0.3,thumbnail.duration*0.1);}catch{}}
 },true);
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('.vela-video-launch');
  if(!trigger)return;
  event.preventDefault();lastTrigger=trigger;
  const thumbnail=trigger.querySelector('video');
  if(!thumbnail)return;
  const src=thumbnail.currentSrc||thumbnail.getAttribute('src');
  if(!src)return;
  player.pause();player.src=src;player.poster=thumbnail.getAttribute('poster')||'';
  player.muted=false;player.playbackRate=1;rate.textContent='1×';
  dialog.querySelector('[data-vv-title]').textContent=trigger.querySelector('.vela-video-foot span')?.textContent||'Video';
  dialog.querySelector('[data-vv-open]').href=src;
  error.hidden=true;
  if(!dialog.open)dialog.showModal();
  document.body.classList.add('vela-video-open');
  refresh();
  player.play().catch(()=>{refresh();});
 });
}
