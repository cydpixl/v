// Three isolated local identities exercise the production CallEngine and Worker.
// TEST_AUTH is accepted by the Worker only on 127.0.0.1; no production identities are created.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5178',uids=['mesh-alpha','mesh-bravo','mesh-charlie'];
async function api(uid,path,method='GET',body){const response=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer test:'+uid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Error(path+': '+data.error);return data;}
for(const [i,uid]of uids.entries())await api(uid,'/me','PUT',{name:'Mesh '+(i+1),handle:'call_mesh_'+i});
for(const uid of uids.slice(1)){
 let state=await api(uid,'/state'),friend=state.friends.find(f=>f.uid===uids[0]);
 if(!friend){await api(uids[0],'/friends','POST',{handle:'call_mesh_'+uids.indexOf(uid)});state=await api(uid,'/state');friend=state.friends.find(f=>f.uid===uids[0]);}
 if(friend.status!=='accepted')await api(uid,'/friends/'+friend.id,'PATCH',{action:'accept'});
}
const conversation=(await api(uids[0],'/conversations','POST',{members:uids.slice(1),group:true,name:'Three-party media QA'})).id;
const {call,members}=await api(uids[0],'/conversations/'+conversation+'/calls','POST',{kind:'video'});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const pages=[];
try{
 for(const uid of uids){
  const context=await browser.newContext({permissions:['camera','microphone']}),page=await context.newPage();pages.push(page);await page.goto(base);
  await page.evaluate(async({uid,call,members})=>{
   const {CallEngine}=await import('/src/call.js');window.meshErrors=[];
   const nativeCapture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=constraints=>nativeCapture({...constraints,video:constraints.video?{...constraints.video,width:{ideal:640,max:640},height:{ideal:360,max:360},frameRate:{ideal:15,max:15}}:false});
   const api=async(path,{method='GET',body,signal}={})=>{const response=await fetch('/api'+path,{method,signal,headers:{Authorization:'Bearer test:'+uid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error),{status:response.status});return data;};
   window.mesh=new CallEngine({api,user:{uid},settings:{muted:true,volume:100,noise:true,echo:true,gain:true}});
   mesh.addEventListener('error',event=>meshErrors.push(event.detail));
   mesh.addEventListener('change',()=>{for(const p of mesh.remote.values()){let v=document.querySelector('[data-mesh="'+p.uid+'"]');if(!v){v=document.createElement('video');v.dataset.mesh=p.uid;v.autoplay=v.muted=v.playsInline=true;document.body.append(v);}if(v.srcObject!==p.streams.camera)v.srcObject=p.streams.camera||null;v.play().catch(()=>{});}});
   mesh.addEventListener('change',()=>{for(const p of mesh.remote.values()){if(!p.state.screen||!p.streams.screen)continue;let v=document.querySelector('[data-screen="'+p.uid+'"]');if(!v){v=document.createElement('video');v.dataset.screen=p.uid;v.autoplay=v.muted=v.playsInline=true;document.body.append(v);}if(v.srcObject!==p.streams.screen)v.srcObject=p.streams.screen;v.play().catch(()=>{});}});
   await mesh.join(call,members);
  },{uid,call,members});
 }
 const decoded=(page,count)=>page.waitForFunction(count=>[...document.querySelectorAll('[data-mesh]')].filter(v=>v.srcObject?.active&&v.videoWidth>0&&v.currentTime>0).length===count,count,{timeout:30000});
 await Promise.all(pages.map(page=>decoded(page,2)));
 for(const page of pages){const media=await page.evaluate(async()=>Promise.all([...mesh.links.values()].map(async link=>{const stats=[...(await link.pc.getStats()).values()];return stats.filter(r=>r.type==='inbound-rtp'&&r.kind==='video').some(r=>r.framesDecoded>0);})));assert.deepEqual(media,[true,true]);}
 console.log('PASS three independent participants each decode both remote cameras over all six WebRTC directions');
 await pages[1].evaluate(()=>{navigator.mediaDevices.getDisplayMedia=()=>navigator.mediaDevices.getUserMedia({video:true,audio:false});return mesh.startShare({quality:'720'});});
 await Promise.all([pages[0],pages[2]].map(page=>page.waitForFunction(()=>{const video=document.querySelector('[data-screen]');return video?.videoWidth>0&&video.currentTime>0;},null,{timeout:30000})));
 await Promise.all(pages.map(page=>decoded(page,2)));await pages[1].evaluate(()=>mesh.stopShare());
 console.log('PASS concurrent screen and camera reach both other participants; stopping screen preserves cameras (simulated screen capture)');

 // Simulate a hardware track ending; real getUserMedia and RTP recovery follow.
 const previous=await pages[0].evaluate(()=>{const track=mesh.camera.getVideoTracks()[0];window.originalCameraId=track.id;track.stop();track.dispatchEvent(new Event('ended'));return track.id;});
 await pages[0].waitForFunction(id=>mesh.cameraWanted&&mesh.camera?.getVideoTracks()[0]?.readyState==='live'&&mesh.camera.getVideoTracks()[0].id!==id,previous,{timeout:15000});
 await Promise.all(pages.map(page=>decoded(page,2)));
 console.log('PASS unexpected camera-track end reacquires a real camera and restores both recipients');

 // A pending recovery must never turn an intentionally disabled camera back on.
 await pages[0].evaluate(()=>{const t=mesh.camera.getVideoTracks()[0];t.stop();t.dispatchEvent(new Event('ended'));return mesh.enableCamera(false);});
 await pages[0].waitForTimeout(1200);
 assert.equal(await pages[0].evaluate(()=>mesh.camera===null&&!mesh.cameraWanted),true);
 await pages[0].evaluate(()=>mesh.enableCamera(true));await Promise.all(pages.map(page=>decoded(page,2)));
 console.log('PASS camera-off cancels pending recovery and remains off until explicitly enabled');

 await pages[0].evaluate(async()=>{mesh.settings.camera='camera-removed-for-qa';await mesh.enableCamera(true);});
 assert.notEqual(await pages[0].evaluate(()=>mesh.settings.camera),'camera-removed-for-qa');
 await Promise.all(pages.map(page=>decoded(page,2)));
 console.log('PASS a removed saved camera falls back to an available device');

 for(let attempt=0;attempt<3;attempt++){
  for(const page of pages)await page.evaluate(()=>{window.savedLinks=new Map([...mesh.links].map(([uid,l])=>[uid,l.pc]));window.savedCamera=mesh.camera;window.savedDevice=mesh.device;window.peerLeaves=[];const original=mesh.receive.bind(mesh);mesh.receive=async msg=>{if(msg.type==='peer-left')peerLeaves.push(msg.uid);return original(msg);};});
  const target=pages[attempt%pages.length];console.log('CHECK signaling interruption',attempt+1);
  await target.evaluate(()=>{window.oldSocket=mesh.socket;mesh.socket.close(4000,'QA signaling interruption');});
  try{await target.waitForFunction(()=>mesh.socket!==oldSocket&&mesh.socket?.readyState===1,null,{timeout:20000});}catch(error){console.log('RECONNECT DIAGNOSTICS',await target.evaluate(()=>({closed:mesh.closed,device:mesh.device,status:mesh.status,socket:mesh.socket?.readyState,retries:mesh.retries,reconnecting:mesh.reconnecting,errors:meshErrors})));throw error;}
  await Promise.all(pages.map(page=>decoded(page,2)));
  for(const page of pages){assert.deepEqual(await page.evaluate(()=>({sameDevice:mesh.device===savedDevice,sameCamera:mesh.camera===savedCamera,samePeers:[...savedLinks].every(([uid,pc])=>mesh.links.get(uid)?.pc===pc),leaves:peerLeaves})),{sameDevice:true,sameCamera:true,samePeers:true,leaves:[]});}
 }
 console.log('PASS three signaling outages preserve device IDs, camera tracks and every existing peer connection without false departures');

 await Promise.all([pages[0],pages[1]].map(page=>page.evaluate(()=>{const target=[...mesh.links.values()].find(l=>l.uid==='mesh-alpha'||l.uid==='mesh-bravo');target.recover();})));
 await Promise.all(pages.map(page=>decoded(page,2)));
 console.log('PASS simultaneous ICE recovery handles offer collisions and keeps all cameras');

 await pages[0].evaluate(()=>mesh.rebuildPeer('mesh-bravo'));
 await Promise.all(pages.map(page=>decoded(page,2)));
 console.log('PASS an unusable peer connection can rebuild without ending the call or stopping local cameras');

 // Microphone and camera senders retain independent tracks throughout sharing.
 for(const page of pages)assert.equal(await page.evaluate(()=>[...mesh.links.values()].every(l=>l.transceivers.mic.sender.track?.readyState==='live'&&l.transceivers.camera.sender.track?.readyState==='live')),true);

 const delayed=pages[2];
 await delayed.evaluate(async()=>{
  await mesh.enableCamera(false);const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.beforeDelayedCapture=native;navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await native(constraints);window.delayedCamera=stream;await new Promise(resolve=>window.releaseCamera=resolve);return stream;};
  window.pendingCamera=mesh.enableCamera(true);
 });
 await delayed.waitForFunction(()=>!!window.releaseCamera);
 await delayed.evaluate(()=>mesh.enableCamera(false));
 await delayed.evaluate(async()=>{releaseCamera();await pendingCamera;});
 assert.equal(await delayed.evaluate(()=>mesh.camera===null&&!mesh.cameraWanted&&delayedCamera.getTracks().every(t=>t.readyState==='ended')),true);
 await delayed.evaluate(async()=>{navigator.mediaDevices.getUserMedia=beforeDelayedCapture;await mesh.enableCamera(true);});
 await Promise.all(pages.map(page=>decoded(page,2)));
 console.log('PASS a delayed permission result is discarded after camera-off and stops every late track');
 await pages[1].evaluate(()=>mesh.enableCamera(false));await pages[1].evaluate(()=>mesh.enableCamera(true));await Promise.all(pages.map(page=>decoded(page,2)));

 await pages[0].evaluate(()=>{window.resumeSignaling=mesh.reconnect.bind(mesh);mesh.reconnect=()=>{};mesh.socket.close(4000,'QA extended signaling outage');});
 assert.equal((await api(uids[0],'/calls/'+call.id)).call.participants.length,3);
 await pages[0].waitForTimeout(16000);
 const during=(await api(uids[1],'/calls/'+call.id)).call;assert.equal(during.participants.length,2,'Expired reconnect leases must not advertise absent participants');
 await pages[0].evaluate(()=>{mesh.reconnect=resumeSignaling;mesh.reconnect(mesh.generation,true);});
 await Promise.all(pages.map(page=>decoded(page,2)));
 console.log('PASS a longer outage expires presence cleanly and restores every camera on reconnect');
 await pages[0].evaluate(()=>mesh.leave());for(const page of pages.slice(1))await page.waitForFunction(()=>mesh.remote.size===1&&[...mesh.links.values()].every(l=>l.pc.connectionState==='connected'));
 const {call:remaining}=await api(uids[0],'/calls/'+call.id);assert.deepEqual(remaining.participants.map(p=>p.uid).sort(),uids.slice(1).sort());
 await pages[0].evaluate(({call,members})=>mesh.join(call,members),{call,members});await Promise.all(pages.map(page=>decoded(page,2)));
 for(const page of pages)assert.deepEqual(await page.evaluate(()=>meshErrors),[]);
 console.log('PASS one participant leaving preserves the other two, roster names match membership, and rejoining restores every camera');
}catch(error){for(const page of pages)console.log('FAILURE STATE',JSON.stringify(await page.evaluate(()=>({uid:mesh.user.uid,status:mesh.status,errors:meshErrors,peers:[...mesh.links].map(([uid,l])=>({uid,epoch:l.epoch,state:l.pc.connectionState,signal:l.pc.signalingState,streams:Object.keys(mesh.remote.get(uid)?.streams||{}),senders:l.pc.getSenders().map(s=>({kind:s.track?.kind,state:s.track?.readyState}))}))}))));throw error;}finally{for(const page of pages)await page.evaluate(()=>mesh?.leave()).catch(()=>{});await browser.close();for(const uid of uids)await api(uid,'/conversations/'+conversation+'/leave','POST').catch(()=>{});}
