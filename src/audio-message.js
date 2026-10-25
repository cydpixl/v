import {icon} from './icons.js';
const format=time=>Number.isFinite(time)?Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0'):'0:00';
export function retainAudioMessages(host){
 const items=[...host.querySelectorAll('[data-message]')].flatMap(message=>[...message.querySelectorAll('.voice-message')].map((node,index)=>({id:message.dataset.message,index,node,playing:!node.querySelector('audio').paused})));
 return ()=>{for(const {id,index,node,playing}of items){const message=[...host.querySelectorAll('[data-message]')].find(el=>el.dataset.message===id),audio=message?.querySelectorAll('audio')[index];if(!audio)continue;audio.replaceWith(node);if(playing)node.querySelector('audio').play().catch(()=>{});}};
}
export function enhanceAudioMessages(host){
 for(const audio of host.querySelectorAll('audio')){
  if(audio.closest('.voice-message'))continue;
  const box=document.createElement('div');box.className='voice-message';
  box.innerHTML=`<button class="voice-message-play" aria-label="Play voice message">${icon('play',18)}</button><div><span class="voice-message-label">Voice message</span><input type="range" min="0" max="1" step="0.1" value="0" aria-label="Voice message position" disabled><span class="voice-message-time">0:00</span></div><button class="voice-message-speed" aria-label="Playback speed: 1 times">1×</button><p class="voice-message-error" role="status" hidden>Audio unavailable. <button>Retry</button></p>`;
  audio.before(box);box.append(audio);audio.controls=false;audio.hidden=true;
  const toggle=box.querySelector('.voice-message-play'),seek=box.querySelector('input'),time=box.querySelector('.voice-message-time'),speed=box.querySelector('.voice-message-speed'),error=box.querySelector('p');
  const update=()=>{const finite=Number.isFinite(audio.duration)&&audio.duration>0;seek.disabled=!finite;seek.max=finite?audio.duration:1;if(document.activeElement!==seek)seek.value=finite?audio.currentTime:0;time.textContent=format(audio.currentTime)+(finite?' / '+format(audio.duration):'');};
  toggle.onclick=async()=>{if(!audio.paused){audio.pause();return;}for(const other of document.querySelectorAll('.voice-message audio'))if(other!==audio)other.pause();try{await audio.play();}catch{error.hidden=false;}};
  for(const event of ['loadedmetadata','durationchange','timeupdate'])audio.addEventListener(event,update);
  audio.addEventListener('play',()=>{toggle.innerHTML=icon('pause',18);toggle.setAttribute('aria-label','Pause voice message');error.hidden=true;});
  const paused=()=>{toggle.innerHTML=icon('play',18);toggle.setAttribute('aria-label','Play voice message');};audio.addEventListener('pause',paused);audio.addEventListener('ended',paused);
  audio.addEventListener('error',()=>{error.hidden=false;});error.querySelector('button').onclick=()=>{audio.load();error.hidden=true;};
  seek.oninput=()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value);update();};
  speed.onclick=()=>{const values=[1,1.25,1.5,2],next=values[(values.indexOf(audio.playbackRate)+1)%values.length];audio.playbackRate=next;speed.textContent=next+'×';speed.setAttribute('aria-label','Playback speed: '+next+' times');};update();
 }
}
