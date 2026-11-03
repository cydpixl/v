import {GAME_SOUNDS} from './audio-data.mjs';
import {registerAppMedia} from '../audio-mixer.mjs';
// Authored Kenney Interface Sounds (CC0). No synthesis or generated audio.
const soundData=name=>Promise.resolve(GAME_SOUNDS[name]);
const FILES={launch:'launch',hover:'hover',start:'start',go:'go',hit:'hit',wrong:'wrong',level:'level',finish:'finish'};
export function gameAudio(root,id,{muted=false}={}){
  const pool=new Map(),last=new Map();let quiet=muted;
  const holder=document.createElement('div');holder.hidden=true;holder.dataset.audioApp=id;root.append(holder);
  function cue(name){if(quiet)return;const now=performance.now();if(now-(last.get(name)||-1000)<(name==='hit'?45:100))return;last.set(name,now);let list=pool.get(name);if(!list){list=Array.from({length:name==='hit'?3:1},()=>{const audio=document.createElement('audio');audio.preload='none';holder.append(audio);registerAppMedia(audio,id,name==='launch'?.4:name==='hover'?.12:.24);return audio;});pool.set(name,list);}const audio=list.find(a=>a.paused)||list[0];soundData(FILES[name]).then(source=>{if(quiet||!root.isConnected||document.hidden)return;if(!audio.getAttribute('src'))audio.src=source;audio.currentTime=0;audio.play().catch(()=>{})}).catch(()=>{});}
  function stop(){for(const list of pool.values())for(const audio of list){audio.pause();audio.currentTime=0;}}
  return {cue,stop,setMuted(value){quiet=value;if(quiet)stop();else cue('hover');},dispose(){stop();holder.remove();}};
}
