import {mediaError} from './util.js';

export async function capturePhoto({modal,stream:callCamera,onSend}){
 let stream,blob,url,closed=false;
 const dialog=modal('Take a Photo',`<div class="camera-preview"><video autoplay playsinline muted></video><img alt="Photo preview" hidden><p role="status">Opening camera…</p></div><p class="form-error" role="alert"></p><footer class="camera-actions"><button class="secondary" data-retake hidden>Retake</button><button class="primary" data-capture disabled>Take Photo</button><button class="primary" data-send hidden>Send Photo</button></footer>`,{wide:true,onclose:()=>{closed=true;stream?.getTracks().forEach(t=>t.stop());if(url)URL.revokeObjectURL(url)}});
 dialog.classList.add('camera-capture');
 const video=dialog.querySelector('video'),image=dialog.querySelector('img'),status=dialog.querySelector('[role=status]'),error=dialog.querySelector('[role=alert]'),capture=dialog.querySelector('[data-capture]'),send=dialog.querySelector('[data-send]'),retake=dialog.querySelector('[data-retake]');
 try{
  stream=callCamera?.active?callCamera.clone():await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1920},height:{ideal:1080},facingMode:'user'}});
  if(closed){stream.getTracks().forEach(t=>t.stop());return}
  video.srcObject=stream;await video.play();if(closed)return;
  const ready=()=>{if(video.videoWidth){capture.disabled=false;status.hidden=true}};
  video.addEventListener('loadeddata',ready,{once:true});ready();
 }catch(e){if(!closed){status.hidden=true;error.textContent=mediaError(e)}}
 capture.onclick=async()=>{
  capture.disabled=true;
  try{const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw Error('Could not capture this frame. Try again.');if(closed)return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);image.src=url;image.hidden=false;video.hidden=true;capture.hidden=true;retake.hidden=send.hidden=false;error.textContent=''}catch(e){error.textContent=e.message;capture.disabled=false}
 };
 retake.onclick=()=>{blob=null;image.hidden=true;video.hidden=false;retake.hidden=send.hidden=true;capture.hidden=false;capture.disabled=false};
 send.onclick=async()=>{send.disabled=retake.disabled=true;error.textContent='';try{await onSend(new File([blob],'Photo-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jpg',{type:'image/jpeg'}));dialog.close()}catch(e){error.textContent=e.message;send.disabled=retake.disabled=false}};
 return dialog;
}
