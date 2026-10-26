import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS||'.private/qa.json','utf8'));
const site=process.env.QA_SITE||'https://cydpixl.github.io/v/',local=process.env.QA_LOCAL==='1';
const output=path.resolve(process.env.QA_OUTPUT||'output/call-stability');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const pages=[],contexts=[],errors=[],checks=[],samples=[];let joined=false;
const pass=message=>{checks.push(message);console.log('PASS',message)};
const decoded=(p,uid)=>p.waitForFunction(uid=>{const v=document.querySelector('.call-tile[data-participant="'+uid+'"] video');return v?.srcObject?.active&&v.videoWidth>0&&v.readyState>=2&&!v.paused;},uid,{timeout:45000});
async function frames(p){
 return p.evaluate(async()=>{
  const e=window.qaCall;
  const peers=await Promise.all([...e.links].map(async([uid,l])=>{
   const stats=[...(await l.pc.getStats()).values()];
   return {uid,state:l.pc.connectionState,
    frames:stats.filter(r=>r.type==='inbound-rtp'&&r.kind==='video').reduce((n,r)=>n+(r.framesDecoded||0),0),
    audioPackets:stats.filter(r=>r.type==='inbound-rtp'&&r.kind==='audio').reduce((n,r)=>n+(r.packetsReceived||0),0)};
  }));
  return {device:e.device,cameraId:e.camera?.getVideoTracks()[0]?.id,cameraState:e.camera?.getVideoTracks()[0]?.readyState,peers};
 });
}
try{
 for(let i=0;i<2;i++){
  const ctx=await browser.newContext({viewport:{width:1536,height:960},permissions:['microphone','camera'],serviceWorkers:'block'});contexts.push(ctx);
  await ctx.addInitScript(({uid})=>{
   localStorage.setItem('vela.theme','midnight');localStorage.setItem('vela.theme.chosen','1');localStorage.setItem('pixl.settings.'+uid,JSON.stringify({sounds:false,muted:true}));
   const original=EventTarget.prototype.addEventListener;
   EventTarget.prototype.addEventListener=function(type,...args){if(type==='change'&&this.links instanceof Map&&this.remote instanceof Map&&typeof this.enableCamera==='function')window.qaCall=this;return original.call(this,type,...args);};
   navigator.mediaDevices.getDisplayMedia=()=>navigator.mediaDevices.getUserMedia({video:true,audio:false});
  },{uid:qa.users[i].uid});
  if(local)await ctx.route('https://cydpixl.github.io/v/**',async route=>{
   const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice(3))||'index.html';
   const root=path.resolve('dist-gh'),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))return route.abort();
   if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'}[path.extname(file)];
   return route.fulfill({status:200,contentType:type||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const p=await ctx.newPage();pages.push(p);p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)console.log('API FAILURE',i,new URL(r.url()).pathname,r.status());});
  p.on('requestfailed',r=>{if(/\/api\/(?:calls\/|ticket)/.test(r.url()))console.log('REQUEST FAILURE',i,new URL(r.url()).pathname,r.failure()?.errorText);});
  await p.goto(site);await p.locator('[name=handle]').fill(qa.users[i].handle);await p.locator('[name=password]').fill(qa.password);await p.getByRole('button',{name:'Log In',exact:true}).click();
  const cid=[qa.users[0].uid,qa.users[1].uid].sort().join(':');await p.locator('.dm-row[data-open="'+cid+'"]').click();
 }
 const[a,b]=pages;
 await a.getByRole('button',{name:'Start Video Call',exact:true}).click();joined=true;
 await b.locator('#workspace-header .join-active-call').click();
 await Promise.all([decoded(a,qa.users[1].uid),decoded(b,qa.users[0].uid)]);
 for(const p of pages)await p.locator('#voice-dock strong').filter({hasText:'Voice Connected'}).waitFor();
 pass('Two signed-in accounts connect with real WebRTC and decoded camera frames');

 const ui=await a.evaluate(()=>{
  const button=document.querySelector('#call-controls [data-action=camera]'),observer=new MutationObserver(()=>{});observer.observe(document.querySelector('#call-controls'),{childList:true,subtree:true});
  for(let n=0;n<100;n++){qaCall.speaking.set(qaCall.user.uid,n%2===0);qaCall.dispatchEvent(new Event('speaking'));qaCall.dispatchEvent(new Event('stats'));qaCall.change();}
  const result={sameButton:button===document.querySelector('#call-controls [data-action=camera]'),mutations:observer.takeRecords().length};observer.disconnect();return result;
 });assert.deepEqual(ui,{sameButton:true,mutations:0});pass('100 speaking/stats updates retain the same call controls with zero child replacements');

 const old=await a.evaluate(()=>{const t=qaCall.camera.getVideoTracks()[0];t.stop();t.dispatchEvent(new Event('ended'));return t.id;});
 await a.waitForFunction(id=>qaCall.camera?.getVideoTracks()[0]?.readyState==='live'&&qaCall.camera.getVideoTracks()[0].id!==id,old,{timeout:15000});
 await decoded(b,qa.users[0].uid);pass('Unexpected capture-track end automatically reacquires the camera');
 await a.evaluate(()=>{const t=qaCall.camera.getVideoTracks()[0];t.stop();t.dispatchEvent(new Event('ended'));});
 await a.locator('#call-controls [data-action=camera]').click();await a.waitForTimeout(1000);
 assert.equal(await a.evaluate(()=>qaCall.camera===null&&!qaCall.cameraWanted),true);
 await a.locator('#call-controls [data-action=camera]').click();await decoded(b,qa.users[0].uid);pass('Manual camera-off cancels recovery; camera-on restores the remote video');

 await a.getByRole('button',{name:'Take a Photo',exact:true}).click();await a.locator('.camera-capture [data-capture]:enabled').waitFor();await a.locator('.camera-capture').getByRole('button',{name:'Close',exact:true}).click();await decoded(b,qa.users[0].uid);
 pass('Opening and closing photo capture preserves the call camera');
 await a.locator('#call-controls [data-action=share]').click();await a.locator('[data-share]').click();
 await b.waitForFunction(()=>document.querySelector('.screen-tile video')?.videoWidth>0);await decoded(b,qa.users[0].uid);
 await a.locator('#call-controls [data-action=stop-share]').click();await b.locator('.screen-tile').waitFor({state:'detached'});await decoded(b,qa.users[0].uid);
 pass('Simulated screen share and camera work together; stopping share preserves camera');

 for(let i=0;i<3;i++){
  console.log('CHECK live signaling interruption',i+1);
  const p=pages[i%2];
  for(const page of pages)await page.evaluate(()=>{window.savedPeer=[...qaCall.links.values()][0].pc;window.savedTrack=qaCall.camera.getVideoTracks()[0];window.savedDevice=qaCall.device;});
  await p.evaluate(index=>{window.previousSocket=qaCall.socket;if(index===0)qaCall.socket.onclose=null;qaCall.socket.close(4000,'QA signaling interruption');},i);
  await p.waitForFunction(()=>qaCall.socket!==previousSocket&&qaCall.socket?.readyState===1,null,{timeout:25000});
  await Promise.all([decoded(a,qa.users[1].uid),decoded(b,qa.users[0].uid)]);
  for(const page of pages)assert.equal(await page.evaluate(()=>qaCall.device===savedDevice&&qaCall.camera.getVideoTracks()[0]===savedTrack&&[...qaCall.links.values()][0].pc===savedPeer),true);
 }
 pass('Three live signaling interruptions preserve both cameras and peer connections');
 await contexts[0].setOffline(true);await a.evaluate(()=>qaCall.socket.close(4000,'QA temporary offline'));await a.waitForTimeout(2500);await contexts[0].setOffline(false);
 await a.waitForFunction(()=>qaCall.socket?.readyState===1,null,{timeout:25000});await decoded(b,qa.users[0].uid);pass('Offline-to-online transition reconnects without a manual rejoin');

 await a.evaluate(async()=>{const link=[...qaCall.links.values()][0];link.available=650000;link.reduced=true;await link.tune();});
 const envelope=await a.evaluate(()=>[...qaCall.links.values()][0].transceivers.camera.sender.getParameters().encodings[0]);assert.ok(envelope.maxBitrate<=650000&&envelope.maxFramerate<=30&&envelope.scaleResolutionDownBy>=2);pass('Congestion limits apply to the real camera sender without stopping capture');

 const soakSeconds=Number(process.env.QA_SOAK_SECONDS)||90;let previous=await Promise.all(pages.map(frames));
 for(let elapsed=0;elapsed<soakSeconds;elapsed+=10){await a.waitForTimeout(10000);const current=await Promise.all(pages.map(frames));
  for(let i=0;i<2;i++){assert.equal(current[i].cameraState,'live');assert.equal(current[i].peers[0].state,'connected');assert.ok(current[i].peers[0].frames>previous[i].peers[0].frames,'Decoded frames must keep advancing');}
  samples.push({seconds:elapsed+10,accounts:current});previous=current;console.log('PASS continuous decoded frames',elapsed+10+'s');
 }
 await a.screenshot({path:path.join(output,'vela-stable-call.png')});pass(soakSeconds+' seconds of continuous two-account decoded video after recovery tests');
 const cid=await a.evaluate(()=>qaCall.info.id);await a.locator('#call-controls [data-action=leave-call]').click();await a.locator('#call-stage').waitFor({state:'hidden'});
 await a.locator('#workspace-header .join-active-call').click();await decoded(b,qa.users[0].uid);assert.equal(await a.evaluate(()=>qaCall.info.id),cid);pass('Leave/rejoin retains the active call and restores camera');
 for(const p of pages)if(await p.locator('#voice-dock [data-action=leave-call]').count())await p.locator('#voice-dock [data-action=leave-call]').click();joined=false;
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'call-stability-qa.json'),JSON.stringify({passed:true,site,local,checks,samples,errors,capture:'Chrome simulated cameras; real WebRTC'},null,2));
}catch(error){for(const[i,p]of pages.entries()){await p.screenshot({path:path.join(output,'call-failure-'+i+'.png')}).catch(()=>{});console.log('ENGINE STATE',await p.evaluate(()=>({status:window.qaCall?.status,closed:window.qaCall?.closed,retries:window.qaCall?.retries,reconnecting:window.qaCall?.reconnecting,socket:window.qaCall?.socket?.readyState,device:window.qaCall?.device,errors:[...document.querySelectorAll('.toast')].map(n=>n.textContent),peers:window.qaCall?[...qaCall.links.values()].map(l=>({state:l.pc.connectionState,signaling:l.pc.signalingState})):[]})).catch(()=>({})));}throw error;}
finally{for(const ctx of contexts)await ctx.setOffline(false).catch(()=>{});if(joined)for(const p of pages)await p.evaluate(()=>window.qaCall?.leave()).catch(()=>{});await browser.close();}
