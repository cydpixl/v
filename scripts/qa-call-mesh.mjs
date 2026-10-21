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
   const api=async(path,{method='GET',body}={})=>{const response=await fetch('/api'+path,{method,headers:{Authorization:'Bearer test:'+uid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error),{status:response.status});return data;};
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
 await pages[1].evaluate(()=>mesh.enableCamera(false));await pages[1].evaluate(()=>mesh.enableCamera(true));await Promise.all(pages.map(page=>decoded(page,2)));
 await pages[0].evaluate(()=>mesh.leave());for(const page of pages.slice(1))await page.waitForFunction(()=>mesh.remote.size===1&&[...mesh.links.values()].every(l=>l.pc.connectionState==='connected'));
 const {call:remaining}=await api(uids[0],'/calls/'+call.id);assert.deepEqual(remaining.participants.map(p=>p.uid).sort(),uids.slice(1).sort());
 await pages[0].evaluate(({call,members})=>mesh.join(call,members),{call,members});await Promise.all(pages.map(page=>decoded(page,2)));
 for(const page of pages)assert.deepEqual(await page.evaluate(()=>meshErrors),[]);
 console.log('PASS one participant leaving preserves the other two, roster names match membership, and rejoining restores every camera');
}finally{for(const page of pages)await page.evaluate(()=>mesh?.leave()).catch(()=>{});await browser.close();for(const uid of uids)await api(uid,'/conversations/'+conversation+'/leave','POST').catch(()=>{});}
