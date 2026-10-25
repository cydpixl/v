export const PLAYBACK_SPEEDS=[.5,.75,1,1.25,1.5,1.75,2];
export function bindVideoTools(container,{uid,shared,next,onNext,onError}){
 const video=container.querySelector('video'),key='vela.video.'+uid;let prefs;
 try{prefs=JSON.parse(localStorage.getItem(key)||'{}')}catch{}prefs=prefs&&typeof prefs==='object'?prefs:{};
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(prefs))}catch{}};
 const bar=document.createElement('div');bar.className='movie-extra-controls';bar.innerHTML=`<button type="button" class="secondary" data-movie-mute aria-label="Mute video">Mute</button><label>Speed <select aria-label="Playback speed">${PLAYBACK_SPEEDS.map(n=>`<option value="${n}">${n}×</option>`).join('')}</select></label><button type="button" class="secondary" data-movie-next>Next video</button><label title="Play the next direct video from the current library filters"><input type="checkbox" aria-label="Autoplay next video">Autoplay next</label><span class="movie-shortcuts">Space: play · J/L: seek · M: mute · F: fullscreen</span>`;container.append(bar);
 const speed=bar.querySelector('select'),autoplay=bar.querySelector('input'),nextButton=bar.querySelector('[data-movie-next]'),mute=bar.querySelector('[data-movie-mute]');
 const volume=container.querySelector('[aria-label="Movie volume"]');
 const volumeChanged=()=>{mute.textContent=video.muted?'Unmute':'Mute';mute.setAttribute('aria-label',video.muted?'Unmute video':'Mute video');mute.setAttribute('aria-pressed',String(video.muted));if(volume)volume.value=video.volume;};
 mute.onclick=()=>{video.muted=!video.muted;};video.addEventListener('volumechange',volumeChanged);
 speed.onchange=()=>{if(shared())return;video.defaultPlaybackRate=video.playbackRate=Number(speed.value);prefs.speed=video.playbackRate;save();};
 autoplay.checked=!!prefs.autoplay;autoplay.onchange=()=>{prefs.autoplay=autoplay.checked;save();};
 nextButton.onclick=()=>Promise.resolve(onNext()).catch(onError);
 const ended=()=>{if(!shared()&&autoplay.checked&&next())nextButton.click();};video.addEventListener('ended',ended);
 function update(){const together=!!shared(),item=next();speed.disabled=together;autoplay.disabled=together;nextButton.disabled=together||!item;nextButton.title=item?'Next: '+(item.showTitle||item.title):'No more direct videos in this view';speed.title=together?'Shared playback stays at 1× to keep everyone in sync':'Playback speed';speed.value=String(!together&&PLAYBACK_SPEEDS.includes(prefs.speed)?prefs.speed:1);video.defaultPlaybackRate=video.playbackRate=Number(speed.value);volumeChanged();}
 update();return {update,dispose(){video.removeEventListener('volumechange',volumeChanged);video.removeEventListener('ended',ended);bar.remove();}};
}
export function waitForMetadata(video,signal){if(signal?.aborted)return Promise.reject(new DOMException('Playback cancelled','AbortError'));if(video.readyState>=1)return Promise.resolve();return new Promise((resolve,reject)=>{const finish=error=>{clearTimeout(timer);video.removeEventListener('loadedmetadata',ready);video.removeEventListener('error',failed);signal?.removeEventListener('abort',cancel);error?reject(error):resolve();},ready=()=>finish(),failed=()=>finish(Error('The video could not load. Try another file.')),cancel=()=>finish(new DOMException('Playback cancelled','AbortError')),timer=setTimeout(()=>finish(Error('Video loading timed out. Try again.')),20000);video.addEventListener('loadedmetadata',ready,{once:true});video.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',cancel,{once:true});});}
