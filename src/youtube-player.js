import {escape as e} from './util.js';
import './youtube-player.css';

let apiReady;
function loadAPI(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiReady)return apiReady;
 apiReady=new Promise((resolve,reject)=>{
  const script=document.createElement('script'),previous=window.onYouTubeIframeAPIReady;
  const timeout=setTimeout(()=>{apiReady=null;script.remove();reject(Error('YouTube did not respond. You can open the video on YouTube.'));},18000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();resolve(window.YT);};
  script.src='https://www.youtube.com/iframe_api';script.referrerPolicy='strict-origin-when-cross-origin';
  script.onerror=()=>{clearTimeout(timeout);apiReady=null;script.remove();reject(Error('YouTube could not load. You can open the video on YouTube.'));};document.head.append(script);
 });return apiReady;
}
export function createYouTubePlayer({modal,api}){
 let active;
 async function open(movie,progress={}){
  active?.close();
  if(!/^[A-Za-z0-9_-]{11}$/.test(movie.sourceId))throw Error('Invalid YouTube video.');
  let yt,tick,closed=false,lastSave=0,savedPosition=0;
  const save=()=>{if(!yt?.getCurrentTime||!yt?.getDuration||![1,2,0].includes(yt.getPlayerState?.()))return;const position=yt.getCurrentTime(),duration=yt.getDuration();if(duration>0&&position>0&&Math.abs(position-savedPosition)>1){savedPosition=position;api('/movie-progress',{method:'POST',body:{id:movie.id,position,duration}}).catch(()=>{});}};
  const dialog=active=modal(movie.title,`<section class="youtube-player" aria-label="YouTube video player"><div class="youtube-video-stage"><div data-youtube-frame></div><div class="youtube-notice" ${movie.embedAllowed===false?'':'hidden'}><h3>Watch on YouTube</h3><p>This uploader allows playback on YouTube only.</p><a class="primary" href="https://www.youtube.com/watch?v=${e(movie.sourceId)}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></div></div><footer><div><strong>${e(movie.channel)}</strong><span data-youtube-status role="status">${movie.embedAllowed===false?'YouTube only':'Loading YouTube…'}</span><output data-youtube-time aria-label="Playback time"></output></div><a href="https://www.youtube.com/watch?v=${e(movie.sourceId)}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></footer></section>`,{wide:true,onclose:()=>{closed=true;save();clearInterval(tick);yt?.destroy();if(active===dialog)active=null;}});
  dialog.classList.add('youtube-player-dialog');const section=dialog.querySelector('.youtube-player'),status=dialog.querySelector('[data-youtube-status]'),notice=dialog.querySelector('.youtube-notice');
  const error=message=>{if(closed)return;section.dataset.playbackState='unavailable';status.textContent=message;notice.hidden=false;notice.querySelector('p').textContent=message;};
  if(movie.embedAllowed===false)return;
  try{
   const YT=await loadAPI();if(closed)return;
   yt=new YT.Player(dialog.querySelector('[data-youtube-frame]'),{videoId:movie.sourceId,width:'100%',height:'100%',playerVars:{autoplay:1,playsinline:1,rel:0,origin:location.origin,start:Math.max(0,Math.floor(progress.position||0))},events:{
    onReady:()=>{if(closed)return;section.dataset.playbackState='ready';const frame=yt.getIframe();frame.title=movie.title;frame.referrerPolicy='strict-origin-when-cross-origin';status.textContent='Ready · YouTube';yt.playVideo();},
    onStateChange:event=>{if(closed)return;const states={1:'Playing',2:'Paused',0:'Ended',3:'Buffering',5:'Ready','-1':'YouTube player'};section.dataset.playbackState=String(event.data);status.textContent=(states[event.data]||'Ready')+' · YouTube';if([0,2].includes(event.data))save();},
    onError:event=>error([101,150].includes(event.data)?'This uploader requires you to watch on YouTube.':event.data===153?'YouTube could not verify this browser. Open on YouTube to watch.':event.data===100?'This video is no longer available on YouTube.':'YouTube could not play this video. Open on YouTube to check its availability.'),
   }});
   tick=setInterval(()=>{if(closed||!yt?.getCurrentTime)return;const position=yt.getCurrentTime(),duration=yt.getDuration(),format=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');section.dataset.position=String(position);section.dataset.duration=String(duration);dialog.querySelector('[data-youtube-time]').textContent=duration>0?format(position)+' / '+format(duration):'';if(Date.now()-lastSave>10000){lastSave=Date.now();save();}},1000);
  }catch(failure){error(failure.message);}
 }
 return {open,close:()=>active?.close()};
}
