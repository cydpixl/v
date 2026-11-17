import './live-studio.css';
export function mountLiveStudio(root,{open,toast}){
 root.classList.add('studio-workspace');let stream=null,recorder=null,parts=[],clip=null,elapsed=0,timer=null;
 const media=root.ownerDocument.createElement('video');media.autoplay=true;media.muted=true;media.playsInline=true;
 root.innerHTML='<div class="studio-shell"><header class="studio-header"><strong><span class="studio-indicator"></span>Live Studio</strong><small>CAPTURE STUDIO</small></header><div class="studio-layout"><main><div class="studio-stage"><div class="studio-stage-empty">Select a camera or screen to begin</div><div class="studio-status">Preview stopped</div></div><div class="studio-controls"><button data-camera>Camera</button><button data-screen>Share screen</button><button data-stop disabled>Stop source</button><button data-record disabled>Start recording</button></div><div class="studio-recording"><span data-clock>00:00</span><button data-save hidden>Download recording</button></div></main><aside><h2>Broadcast tools</h2><p>Use the preview to frame your camera or screen. Record a session, or share your screen in a Vela call with a friend.</p><button data-chat>Open Messages for live calls</button><h3>Source</h3><p data-info>No source connected</p><h3>Audio</h3><label><input type="checkbox" data-mic checked> Capture microphone when available</label><p class="studio-note">Recording works entirely in this browser. Public broadcasting requires a streaming server and is not enabled.</p></aside></div></div>';
 const stage=root.querySelector('.studio-stage'),status=root.querySelector('.studio-status');stage.insertBefore(media,status);media.hidden=true;
 function report(msg){root.querySelector('[data-info]').textContent=msg}
 function update(){const active=!!stream;root.querySelector('[data-stop]').disabled=!active;root.querySelector('[data-record]').disabled=!active;root.querySelector('[data-record]').textContent=recorder?.state==='recording'?'Stop recording':'Start recording';status.textContent=recorder?.state==='recording'?'Recording':active?'Preview running':'Preview stopped';stage.classList.toggle('active',active)}
 function stopStream(){if(recorder?.state==='recording')recorder.stop();if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}media.srcObject=null;media.hidden=true;stage.querySelector('.studio-stage-empty').hidden=false;report('No source connected');update()}
 async function capture(kind){stopStream();try{const audio=root.querySelector('[data-mic]').checked;if(kind==='screen')stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio});else stream=await navigator.mediaDevices.getUserMedia({video:true,audio});media.srcObject=stream;media.hidden=false;stage.querySelector('.studio-stage-empty').hidden=true;stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(stream)stopStream()},{once:true});report((kind==='screen'?'Screen':'Camera')+' · '+stream.getVideoTracks()[0]?.label);update();await media.play().catch(()=>{});}catch(error){report(error.message||'Permission not granted');toast(error.message||'Could not open this source')}}
 root.querySelector('[data-camera]').onclick=()=>capture('camera');
 root.querySelector('[data-screen]').onclick=()=>capture('screen');
 root.querySelector('[data-stop]').onclick=stopStream;
 root.querySelector('[data-chat]').onclick=()=>open('chat');
 root.querySelector('[data-record]').onclick=()=>{
 if(recorder?.state==='recording'){recorder.stop();return}
 if(!stream||!window.MediaRecorder)return toast('Recording is unavailable in this browser.');
 parts=[];const type=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
 try{recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined)}catch(error){return toast(error.message)}
 recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
 recorder.onstop=()=>{if(clip)URL.revokeObjectURL(clip);const blob=new Blob(parts,{type:recorder.mimeType||'video/webm'});clip=URL.createObjectURL(blob);const save=root.querySelector('[data-save]');save.hidden=!blob.size;save.onclick=()=>{const link=document.createElement('a');link.href=clip;link.download='vela-live-studio-'+new Date().toISOString().slice(0,10)+'.webm';link.click()};clearInterval(timer);timer=null;update()};
 recorder.start(250);elapsed=0;clearInterval(timer);timer=setInterval(()=>{elapsed++;root.querySelector('[data-clock]').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0')},1000);update()
 };
 update();
 return()=>{clearInterval(timer);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());if(clip)URL.revokeObjectURL(clip);media.srcObject=null};
}
