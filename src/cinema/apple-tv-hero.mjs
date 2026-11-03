import {assetURL} from '../config.js';
import {escape as e} from '../util.js';
import {icon} from '../icons.js';
import './apple-tv-hero.css';

const heroAsset=value=>value?.startsWith('https://')?value:assetURL(value);
const chevron=direction=>`<svg viewBox="0 0 16 32" fill="none" aria-hidden="true"><path d="${direction<0?'M11 3 5 16 11 29':'M5 3 11 16 5 29'}" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export function mountAppleTVHero(host,{slides,onPlay,onSave,isSaved=()=>false,onError=()=>{}}){
 let index=0,muted=true,hls=null,epoch=0,timer=0,advance=0,disposed=false,visible=true,suspended=false,loadingVideo=false;
 const events=new AbortController(),windowNode=host.closest('.desktop-window');
 host.className='atv-feature';host.setAttribute('role','region');host.setAttribute('aria-roledescription','carousel');host.setAttribute('aria-label','Featured on Apple TV');
 host.innerHTML=`<div class="atv-feature-art"></div><video class="atv-feature-video" muted playsinline preload="none" data-audio-app="apple-tv" aria-label="Featured trailer" disablepictureinpicture></video><div class="atv-feature-shade"></div><div class="atv-feature-copy"></div><button class="atv-feature-arrow previous" aria-label="Previous featured title">${chevron(-1)}</button><button class="atv-feature-arrow next" aria-label="Next featured title">${chevron(1)}</button><button class="atv-feature-mute" aria-label="Unmute trailer" aria-pressed="false" hidden>${icon('volumeOff',18)}</button><div class="atv-feature-dots" role="group" aria-label="Choose featured title">${slides.map((slide,i)=>`<button aria-label="Show ${e(slide.title)}" aria-current="${i===0?'true':'false'}" data-feature-index="${i}"><i></i></button>`).join('')}</div>`;
 const video=host.querySelector('video'),art=host.querySelector('.atv-feature-art'),copy=host.querySelector('.atv-feature-copy'),mute=host.querySelector('.atv-feature-mute');
 video.muted=true;video.volume=.7;video.crossOrigin='anonymous';
 const active=()=>!disposed&&host.isConnected&&visible&&!document.hidden&&!windowNode?.hidden&&!suspended;
 function clearPlayback(){clearTimeout(timer);clearTimeout(advance);epoch++;hls?.destroy();hls=null;loadingVideo=false;video.pause();video.removeAttribute('src');video.load();host.classList.remove('trailer-playing');mute.hidden=true;}
 function schedule(){clearTimeout(timer);if(active()&&!video.getAttribute('src')&&!hls)timer=setTimeout(startTrailer,4000);}
 function choose(next){
  clearPlayback();index=(next+slides.length)%slides.length;const slide=slides[index];
  host.dataset.featureIndex=index;host.dataset.featureTitle=slide.title;
  art.innerHTML=`<img src="${heroAsset(slide.artwork)}" alt="${e(slide.title)}" fetchpriority="high">`;
  copy.innerHTML=`${slide.logo?`<img class="atv-feature-logo" src="${heroAsset(slide.logo)}" alt="${e(slide.title)}">`:`<h1>${e(slide.title)}</h1>`}<div class="atv-feature-meta"><img src="${assetURL('app-icons/apple-tv.png')}" alt="Apple TV"><span>${e(slide.metadata.join(' · '))}</span>${slide.rating?`<small>${e(slide.rating)}</small>`:''}</div>${slide.description?`<p class="atv-feature-description">${e(slide.description)}</p>`:''}${slide.tagline?`<p class="atv-feature-tagline">${e(slide.tagline)}</p>`:''}<div class="atv-feature-actions"><button data-feature-play>${icon('play',14)} Play</button><button data-feature-save aria-label="${isSaved(slide)?'Remove from':'Add to'} Library: ${e(slide.title)}" aria-pressed="${isSaved(slide)}">${icon(isSaved(slide)?'check':'plus',20)}</button></div>`;
  host.querySelectorAll('[data-feature-index]').forEach((button,i)=>button.setAttribute('aria-current',String(i===index)));
  copy.querySelector('[data-feature-play]').onclick=()=>Promise.resolve(onPlay(slide)).catch(error=>onError(error.message));
  copy.querySelector('[data-feature-save]').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await onSave(slide);if(!button.isConnected)return;const saved=isSaved(slide);button.innerHTML=icon(saved?'check':'plus',20);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',(saved?'Remove from':'Add to')+' Library: '+slide.title)}catch(error){onError(error.message)}finally{button.disabled=false}};
  schedule();
 }
 function fallback(){video.pause();host.classList.remove('trailer-playing');mute.hidden=true;hls?.destroy();hls=null;clearTimeout(advance);if(active())advance=setTimeout(()=>choose(index+1),10000);}
 async function startTrailer(){
  if(!active()||loadingVideo)return;loadingVideo=true;const token=epoch,slide=slides[index];
  if(!slide.trailer){loadingVideo=false;fallback();return}
  try{
   const [{default:Hls},{default:workerPath}]=await Promise.all([import('hls.js'),import('hls.js/dist/hls.worker.js?url')]);if(token!==epoch||disposed)return;
   if(Hls.isSupported()){hls=new Hls({workerPath,enableWorker:true,capLevelToPlayerSize:true,maxBufferLength:12,maxMaxBufferLength:20,startLevel:-1,abrEwmaDefaultEstimate:5000000,maxBufferSize:20*1000*1000});hls.on(Hls.Events.ERROR,(_,data)=>{if(token===epoch&&data.fatal)fallback()});hls.loadSource(slide.trailer);hls.attachMedia(video);}
   else if(video.canPlayType('application/vnd.apple.mpegurl'))video.src=slide.trailer;
   else{fallback();return}
   video.muted=muted;await video.play();if(token!==epoch||disposed)return;
   clearTimeout(advance);advance=setTimeout(()=>{if(active())choose(index+1)},65000);
  }catch{if(token===epoch)fallback()}finally{if(token===epoch)loadingVideo=false}
 }
 function updateVisibility(){
  if(active()){if(video.currentSrc||hls){hls?.startLoad();video.play().catch(()=>{});}else schedule()}
  else{clearTimeout(timer);clearTimeout(advance);video.pause();hls?.stopLoad()}
 }
 video.addEventListener('playing',()=>{if(!active()){video.pause();return}host.classList.add('trailer-playing');mute.hidden=false},{signal:events.signal});
 video.addEventListener('ended',()=>{if(active())choose(index+1)},{signal:events.signal});
 video.addEventListener('error',()=>{if(video.getAttribute('src'))fallback()},{signal:events.signal});
 mute.onclick=()=>{muted=!muted;video.muted=muted;mute.innerHTML=icon(muted?'volumeOff':'volume',18);mute.setAttribute('aria-label',muted?'Unmute trailer':'Mute trailer');mute.setAttribute('aria-pressed',String(!muted))};
 host.querySelector('.previous').onclick=()=>choose(index-1);host.querySelector('.next').onclick=()=>choose(index+1);
 host.querySelectorAll('[data-feature-index]').forEach(button=>button.onclick=()=>choose(Number(button.dataset.featureIndex)));
 host.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();choose(index+(event.key==='ArrowLeft'?-1:1))}},{signal:events.signal});
 document.addEventListener('visibilitychange',updateVisibility,{signal:events.signal});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;updateVisibility()},{threshold:.15});observer.observe(host);
 const hiddenObserver=new MutationObserver(updateVisibility);if(windowNode)hiddenObserver.observe(windowNode,{attributes:true,attributeFilter:['hidden']});
 choose(0);
 return {pause(){suspended=true;updateVisibility()},resume(){suspended=false;updateVisibility()},destroy(){disposed=true;events.abort();observer.disconnect();hiddenObserver.disconnect();clearPlayback()}};
}
