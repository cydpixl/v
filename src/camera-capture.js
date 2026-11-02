import {mediaError} from './util.js';

export async function capturePhoto({modal,stream:callCamera,settings={},onSend,onDeviceChange}){
 let stream,blob,url,closed=false,facing=settings.facing||'user';
 const dialog=modal('Take a Photo',`<div class="camera-preview"><video autoplay playsinline muted></video><img alt="Photo preview" hidden><p role="status">Opening camera…</p><span class="camera-grid" hidden></span><span class="camera-countdown" hidden></span></div><p class="form-error" role="alert"></p><footer class="camera-actions"><button class="secondary" data-grid>Grid</button><label>Timer <select data-timer><option value="0">Off</option><option value="3">3 seconds</option><option value="5">5 seconds</option></select></label><button class="secondary" data-flip-camera>Flip Camera</button><button class="secondary" data-retake hidden>Retake</button><button class="primary" data-capture disabled>Take Photo</button><button class="primary" data-send hidden>Send Photo</button></footer>`,{wide:true,onclose:()=>{closed=true;stream?.getTracks().forEach(t=>t.stop());if(url)URL.revokeObjectURL(url)}});
 dialog.classList.add('camera-capture');
 const video=dialog.querySelector('video'),image=dialog.querySelector('img'),status=dialog.querySelector('[role=status]'),error=dialog.querySelector('[role=alert]'),capture=dialog.querySelector('[data-capture]'),send=dialog.querySelector('[data-send]'),retake=dialog.querySelector('[data-retake]'),flip=dialog.querySelector('[data-flip-camera]');
 const activate=async({initial=false}={})=>{
  capture.disabled=flip.disabled=true;status.hidden=false;status.textContent=initial?'Opening camera…':'Switching camera…';error.textContent='';
  const old=stream,current=old?.getVideoTracks()[0]?.getSettings().deviceId;let deviceId=settings.camera||'';
  if(!initial){const devices=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput');const index=devices.findIndex(device=>device.deviceId===current);if(devices.length>1)deviceId=devices[(index+1+devices.length)%devices.length].deviceId;else{deviceId='';facing=facing==='environment'?'user':'environment'}}
  let next;
  if(initial&&callCamera?.active)next=callCamera.clone();
  else try{next=await navigator.mediaDevices.getUserMedia({audio:false,video:{deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:1920},height:{ideal:1080},facingMode:deviceId?undefined:{ideal:facing}}})}
  catch(cause){if(!deviceId)throw cause;deviceId='';next=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1920},height:{ideal:1080},facingMode:{ideal:facing}}})}
  if(closed){next.getTracks().forEach(track=>track.stop());return}
  stream=next;video.srcObject=next;await video.play();old?.getTracks().forEach(track=>track.stop());const track=next.getVideoTracks()[0],actual=track.getSettings();settings.camera=actual.deviceId||deviceId||'';settings.facing=actual.facingMode||facing;onDeviceChange?.({camera:settings.camera,facing:settings.facing,label:track.label});
  const ready=()=>{if(video.videoWidth){capture.disabled=flip.disabled=false;status.hidden=true}};video.addEventListener('loadeddata',ready,{once:true});ready();
 };
 try{
  await activate({initial:true});
 }catch(e){if(!closed){status.hidden=true;error.textContent=mediaError(e)}}
 flip.onclick=async()=>{try{await activate()}catch(e){status.hidden=true;error.textContent=mediaError(e);capture.disabled=flip.disabled=false}};
 dialog.querySelector('[data-grid]').onclick=()=>{const grid=dialog.querySelector('.camera-grid');grid.hidden=!grid.hidden};
 capture.onclick=async()=>{
  capture.disabled=true;
  try{const count=dialog.querySelector('.camera-countdown');for(let n=Number(dialog.querySelector('[data-timer]').value);n>0;n--){count.hidden=false;count.textContent=n;await new Promise(resolve=>setTimeout(resolve,1000));if(closed)return;}count.hidden=true;if(!video.videoWidth||!video.videoHeight)throw Error('Camera is not ready. Try again.');const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw Error('Could not capture this frame. Try again.');if(closed)return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);image.src=url;image.hidden=false;video.hidden=true;capture.hidden=true;retake.hidden=send.hidden=false;error.textContent=''}catch(e){error.textContent=e.message;capture.disabled=false}
 };
 retake.onclick=()=>{blob=null;image.hidden=true;video.hidden=false;retake.hidden=send.hidden=true;capture.hidden=false;capture.disabled=false};
 send.onclick=async()=>{if(!blob||closed)return;send.disabled=retake.disabled=true;error.textContent='';try{await onSend(new File([blob],'Photo-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jpg',{type:'image/jpeg'}));dialog.close()}catch(e){error.textContent=e.message;send.disabled=retake.disabled=false}};
 return dialog;
}
