import {mediaError} from './util.js';
import {createElement,Camera,Video,SwitchCamera,Settings2,Grid2X2,Send,RotateCcw} from 'lucide';
const glyph=node=>createElement(node,{width:24,height:24,'stroke-width':1.75,'aria-hidden':'true'}).outerHTML;

// Own only cloned call tracks or tracks opened by this panel. Closing never ends a call.
export async function capturePhoto({modal,stream:callCamera,settings={},onSend,onDeviceChange}){
 let stream,pendingStream,blob,url,recorder,recordingStream,recordTimer,removalObserver,closed=false,mode='photo',state='opening',facing=settings.facing||'user',generation=0,elapsed=0;
 const dialog=modal('Take a Photo',`<div class="camera-preview"><video data-live autoplay playsinline muted></video><img alt="Photo preview" hidden><video data-playback playsinline controls hidden></video><p role="status">Opening camera…</p><span class="camera-grid" hidden></span><span class="camera-countdown" hidden></span><span class="camera-recording" hidden><i></i><span>00:00</span></span></div><p class="form-error" role="alert"></p><div class="camera-settings" hidden><button type="button" data-grid aria-pressed="false">${glyph(Grid2X2)} Grid</button><label>Timer <select data-timer><option value="0">Off</option><option value="3">3 seconds</option><option value="5">5 seconds</option></select></label><label class="camera-mic"><input type="checkbox" data-mic> Record microphone in videos</label></div><footer class="camera-actions"><div class="camera-left-controls"><div class="camera-mode" role="group" aria-label="Capture mode"><button type="button" data-mode="photo" aria-pressed="true">${glyph(Camera)} Photo</button><button type="button" data-mode="video" aria-pressed="false">${glyph(Video)} Video</button></div><span class="camera-divider"></span><button type="button" data-flip-camera disabled>${glyph(SwitchCamera)} Flip</button></div><button type="button" class="camera-shutter" data-capture disabled aria-label="Take photo"><span></span></button><div class="camera-right-controls"><span class="camera-divider"></span><button type="button" data-settings aria-label="Camera settings" aria-expanded="false">${glyph(Settings2)}</button><button type="button" data-retry hidden>Retry camera</button></div><div class="camera-review" hidden><button type="button" data-retake>${glyph(RotateCcw)} Retake</button><button type="button" data-send>${glyph(Send)} Send to Chat</button></div></footer>`,{wide:true,onclose:dispose});
 dialog.classList.add('camera-capture');
 dialog.querySelector('h2').insertAdjacentHTML('afterbegin',glyph(Camera));
 const video=dialog.querySelector('[data-live]'),playback=dialog.querySelector('[data-playback]'),image=dialog.querySelector('img'),status=dialog.querySelector('[role=status]'),error=dialog.querySelector('[role=alert]'),capture=dialog.querySelector('[data-capture]'),send=dialog.querySelector('[data-send]'),retake=dialog.querySelector('[data-retake]'),flip=dialog.querySelector('[data-flip-camera]'),retry=dialog.querySelector('[data-retry]'),modes=[...dialog.querySelectorAll('[data-mode]')],mic=dialog.querySelector('[data-mic]');
 function stopTracks(value){value?.getTracks().forEach(track=>track.stop());}
 function dispose(){if(closed)return;closed=true;removalObserver?.disconnect();generation++;clearInterval(recordTimer);if(recorder?.state==='recording')recorder.stop();stopTracks(recordingStream);stopTracks(pendingStream);stopTracks(stream);video.srcObject=null;playback.pause();playback.removeAttribute('src');if(url)URL.revokeObjectURL(url);}
 function controls(){const locked=['opening','countdown','recording','processing','sending'].includes(state),review=['review','sending'].includes(state);dialog.dataset.state=state;capture.disabled=!['live','recording'].includes(state);capture.hidden=review;flip.disabled=state!=='live';modes.forEach(b=>b.disabled=locked||review);mic.disabled=locked||review;dialog.querySelector('[data-settings]').disabled=locked||review;dialog.querySelector('.camera-review').hidden=!review;send.disabled=retake.disabled=state==='sending';capture.setAttribute('aria-label',state==='recording'?'Stop recording':mode==='video'?'Record video':'Take photo');retry.hidden=state!=='error';}
 function fail(cause){if(closed)return;state=video.videoWidth&&stream?.active?'live':'error';status.hidden=true;error.textContent=mediaError(cause);controls();}
 const activate=async({initial=false}={})=>{
  const version=++generation;state='opening';controls();status.hidden=false;status.textContent=initial?'Opening camera…':'Switching camera…';error.textContent='';
  const old=stream,current=old?.getVideoTracks()[0]?.getSettings().deviceId;let deviceId=settings.camera||'',next;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera capture needs a secure browser connection.');
   if(!initial){const devices=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput');const index=devices.findIndex(device=>device.deviceId===current);if(devices.length>1)deviceId=devices[(index+1+devices.length)%devices.length].deviceId;else{deviceId='';facing=facing==='environment'?'user':'environment';}}
   if(initial&&callCamera?.active)next=new MediaStream(callCamera.getVideoTracks().map(track=>track.clone()));
   else try{next=await navigator.mediaDevices.getUserMedia({audio:false,video:{deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:1920},height:{ideal:1080},facingMode:deviceId?undefined:{ideal:facing}}});}
   catch(cause){if(!deviceId)throw cause;deviceId='';next=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1920},height:{ideal:1080},facingMode:{ideal:facing}}});}
   if(closed||version!==generation){stopTracks(next);return;}
   pendingStream=next;video.srcObject=next;await video.play();
   // Some browsers resolve play before the first frame is available.
   if(!video.videoWidth)await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{video.removeEventListener('loadeddata',ready);reject(Error('Camera did not provide a frame. Try again.'));},10000);function ready(){clearTimeout(timeout);resolve();}video.addEventListener('loadeddata',ready,{once:true});});
   if(closed||version!==generation){stopTracks(next);return;}
   stream=next;pendingStream=null;stopTracks(old);const track=next.getVideoTracks()[0],actual=track.getSettings();settings.camera=actual.deviceId||deviceId||'';settings.facing=actual.facingMode||facing;onDeviceChange?.({camera:settings.camera,facing:settings.facing,label:track.label});
   video.classList.toggle('camera-mirrored',settings.facing==='user');state='live';status.hidden=true;controls();track.addEventListener('ended',()=>{if(!closed&&stream===next){if(recorder?.state==='recording')recorder.stop();fail(Error('Camera disconnected. Reconnect it and retry.'));}});
  }catch(cause){if(next&&next!==stream)stopTracks(next);pendingStream=null;if(!closed&&version===generation){video.srcObject=old||null;fail(cause);}}
 };
 function review(value){if(closed)return;blob=value;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);video.hidden=true;status.hidden=true;dialog.querySelector('.camera-grid').hidden=true;if(mode==='photo'){image.src=url;image.hidden=false;}else{playback.src=url;playback.hidden=false;}state='review';error.textContent='';controls();}
 async function record(){
  if(typeof MediaRecorder==='undefined')throw Error('Video recording is unavailable in this browser. You can still take photos.');
  let audio;
  try{
   if(mic.checked)audio=await navigator.mediaDevices.getUserMedia({video:false,audio:true});
   if(closed){stopTracks(audio);return;}
   recordingStream=new MediaStream([...stream.getVideoTracks().map(t=>t.clone()),...(audio?.getAudioTracks()||[])]);
   const mimeType=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
   recorder=new MediaRecorder(recordingStream,mimeType?{mimeType}:undefined);const chunks=[];let bytes=0,failed=false;
   recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>=90*1024**2&&recorder.state==='recording')recorder.stop();}};
   recorder.onerror=event=>{failed=true;clearInterval(recordTimer);stopTracks(recordingStream);dialog.querySelector('.camera-recording').hidden=true;fail(event.error||Error('Video recording failed. Try again.'));};
   recorder.onstop=()=>{clearInterval(recordTimer);stopTracks(recordingStream);dialog.querySelector('.camera-recording').hidden=true;if(closed||failed)return;const result=new Blob(chunks,{type:(recorder.mimeType||mimeType||'video/webm').split(';')[0]});if(!result.size){fail(Error('No video was recorded. Try again.'));return;}review(result);};
   recorder.start(500);state='recording';elapsed=0;dialog.querySelector('.camera-recording span').textContent='00:00';dialog.querySelector('.camera-recording').hidden=false;controls();recordTimer=setInterval(()=>{elapsed++;dialog.querySelector('.camera-recording span').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');if(elapsed>=180&&recorder.state==='recording')recorder.stop();},1000);
  }catch(cause){stopTracks(audio);stopTracks(recordingStream);throw cause;}
 }
 flip.onclick=()=>activate();retry.onclick=()=>activate({initial:true});
 modes.forEach(button=>button.onclick=()=>{mode=button.dataset.mode;modes.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));dialog.querySelector('h2').innerHTML=glyph(mode==='photo'?Camera:Video)+(mode==='photo'?'Take a Photo':'Record a Video');dialog.setAttribute('aria-label',mode==='photo'?'Take a Photo':'Record a Video');controls();});
 dialog.querySelector('[data-settings]').onclick=event=>{const panel=dialog.querySelector('.camera-settings');panel.hidden=!panel.hidden;event.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));};
 dialog.querySelector('[data-grid]').onclick=event=>{const grid=dialog.querySelector('.camera-grid');grid.hidden=!grid.hidden;event.currentTarget.setAttribute('aria-pressed',String(!grid.hidden));};
 capture.onclick=async()=>{
  if(state==='recording'){state='processing';controls();recorder.stop();return;}
  if(state!=='live')return;state='countdown';controls();error.textContent='';
  try{
   const count=dialog.querySelector('.camera-countdown');for(let n=Number(dialog.querySelector('[data-timer]').value);n>0;n--){count.hidden=false;count.textContent=n;await new Promise(resolve=>setTimeout(resolve,1000));if(closed)return;}count.hidden=true;
   if(!video.videoWidth||!video.videoHeight||!stream?.active)throw Error('Camera is not ready. Try again.');
   if(mode==='video'){await record();return;}
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const context=canvas.getContext('2d');if(video.classList.contains('camera-mirrored')){context.translate(canvas.width,0);context.scale(-1,1);}context.drawImage(video,0,0);const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!result)throw Error('Could not capture this frame. Try again.');review(result);
  }catch(cause){fail(cause);}
 };
 retake.onclick=()=>{blob=null;if(url){URL.revokeObjectURL(url);url=null;}playback.pause();playback.removeAttribute('src');playback.load();image.removeAttribute('src');image.hidden=playback.hidden=true;video.hidden=false;state=stream?.active?'live':'error';dialog.querySelector('.camera-grid').hidden=dialog.querySelector('[data-grid]').getAttribute('aria-pressed')!=='true';controls();};
 send.onclick=async()=>{if(!blob||closed||state!=='review')return;state='sending';controls();playback.pause();error.textContent='';try{const extension=mode==='photo'?'jpg':blob.type.includes('mp4')?'mp4':'webm';await onSend(new File([blob],`${mode==='photo'?'Photo':'Video'}-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`,{type:blob.type}));if(!closed)dialog.close();}catch(cause){if(!closed){state='review';error.textContent=cause.message;controls();}}};
 dialog.addEventListener('cancel',event=>{if(state==='sending')event.preventDefault();});
 dialog.querySelector('header button').addEventListener('click',event=>{if(state==='sending'){event.preventDefault();event.stopImmediatePropagation();}},true);
 removalObserver=new MutationObserver(()=>{if(!dialog.isConnected)dispose();});removalObserver.observe(dialog.parentNode,{childList:true});
 await activate({initial:true});return dialog;
}
