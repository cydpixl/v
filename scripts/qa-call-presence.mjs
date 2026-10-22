import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture=JSON.parse(fs.readFileSync('.private/qa.json','utf8'));
const site=process.env.QA_SITE||'http://127.0.0.1:5178/';
const apiOrigin=process.env.QA_API_ORIGIN||new URL(site).origin;
const key=fs.readFileSync('src/auth.js','utf8').match(/apiKey:'([^']+)'/)[1];
const tokens=await Promise.all(fixture.users.slice(0,2).map(async u=>{
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.handle+'@users.connections.invalid',password:fixture.password,returnSecureToken:true})});
 const data=await response.json();assert.ok(data.idToken,'Test account sign-in');return data.idToken;
}));
async function api(index,path,method='GET',body){
 const response=await fetch(apiOrigin+'/api'+path,{method,headers:{Authorization:'Bearer '+tokens[index],'Content-Type':'application/json',Origin:new URL(site).origin},body:body?JSON.stringify(body):undefined});
 const data=await response.json();assert.ok(response.ok,method+' '+path+': '+(data.error||response.status));return data;
}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const pages=[],devices=new Map(),errors=[],groups=[],requests=[];
fs.mkdirSync('output/playwright',{recursive:true});
let cid;
async function login(index){
 const context=await browser.newContext({permissions:['microphone','camera'],viewport:{width:1600,height:1000}}),page=await context.newPage();pages.push(page);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',async response=>{if(response.status()>=400&&response.url().includes('/api/'))requests.push({path:new URL(response.url()).pathname,status:response.status(),error:(await response.json().catch(()=>({}))).error});});
 await page.addInitScript(()=>{window.qaToasts=[];document.addEventListener('DOMContentLoaded',()=>new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n instanceof HTMLElement&&n.classList.contains('toast'))qaToasts.push(n.textContent);}).observe(document.body,{childList:true,subtree:true}));});
 page.on('websocket',socket=>{if(socket.url().includes('/calls/'))devices.set(page,{id:socket.url().match(/\/calls\/([^/]+)/)[1],device:new URL(socket.url()).searchParams.get('device'),index});});
 await page.goto(site);await page.locator('[name=handle]').fill(fixture.users[index].handle);await page.locator('[name=password]').fill(fixture.password);await page.locator('form button[type=submit]').click();await page.locator('.app-shell').waitFor();return page;
}
const connected=page=>page.locator('#voice-dock strong').filter({hasText:'Voice Connected'}).waitFor({timeout:30000});
async function remoteFrames(page,uid){await page.waitForFunction(uid=>{const v=document.querySelector('.call-tile[data-participant="'+uid+'"] video');return v?.videoWidth>0&&v.readyState>=2&&v.currentTime>0;},uid,{timeout:30000});}
async function leave(page){const response=page.waitForResponse(r=>r.url().endsWith('/leave')&&r.url().includes('/calls/')&&r.request().method()==='POST');await page.locator('#call-controls [data-action=leave-call]').click();await response;await page.locator('#call-stage').waitFor({state:'hidden'});}
async function roster(index,id,uids){
 await assertEventually(async()=>{const data=await api(index,'/calls/'+id);assert.deepEqual((data.call?.participants||[]).map(p=>p.uid).sort(),[...uids].sort());});
}
async function assertEventually(fn,timeout=10000){const until=Date.now()+timeout;let last;do{try{return await fn();}catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,150));}}while(Date.now()<until);throw last;}
try{
 let state=await api(1,'/state');if(!state.friends.some(f=>f.uid===fixture.users[0].uid&&f.status==='accepted')){
  if(!state.friends.some(f=>f.uid===fixture.users[0].uid)){await api(0,'/friends','POST',{handle:fixture.users[1].handle});state=await api(1,'/state');}
  const friend=state.friends.find(f=>f.uid===fixture.users[0].uid);await api(1,'/friends/'+encodeURIComponent(friend.id),'PATCH',{action:'accept'});
 }
 cid=(await api(0,'/conversations','POST',{members:[fixture.users[1].uid],group:true,name:'Call presence QA '+Date.now()})).id;groups.push(cid);
 for(let i=0;i<15;i++)assert.ok((await api(0,'/ice')).iceServers.length);console.log('PASS more than 12 network-configuration requests remain available for rejoining');
 const starts=await Promise.all([api(0,'/conversations/'+cid+'/calls','POST',{kind:'video'}),api(1,'/conversations/'+cid+'/calls','POST',{kind:'video'})]);
 assert.equal(starts[0].call.id,starts[1].call.id,'Simultaneous callers must use the same room');
 const id=starts[0].call.id;assert.equal((await api(0,'/calls/'+id)).call,null,'A database row alone must not advertise a participant or ring');
 const caller=fixture.users.findIndex(u=>u.uid===starts[0].call.caller),recipient=1-caller;
 const a=await login(caller),b=await login(recipient);for(const p of [a,b])await p.locator('.dm-row[data-open="'+cid+'"]').click();
 await a.getByRole('button',{name:'Start Video Call',exact:true}).click();
 await b.locator('#incoming-call .incoming-card').waitFor();await b.locator('#conversation-call-presence').getByText('In call: '+(await api(recipient,'/state')).conversations.find(c=>c.id===cid).members.find(m=>m.uid===fixture.users[caller].uid).name,{exact:true}).waitFor();
 await b.locator('[data-action=accept-call]').click();await Promise.all([connected(a),connected(b)]);
 await Promise.all([remoteFrames(a,fixture.users[recipient].uid),remoteFrames(b,fixture.users[caller].uid)]);
 await roster(caller,id,fixture.users.slice(0,2).map(u=>u.uid));
 console.log('PASS simultaneous starts share one room; no empty phantom invite; incoming call and two-way decoded camera frames');
 if(process.env.QA_PRESENTATION==='1'){
  await a.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=()=>navigator.mediaDevices.getUserMedia({video:true,audio:false});});await a.locator('#call-controls [data-action=share]').click();await a.locator('[data-share]').click();
  await b.waitForFunction(()=>document.querySelector('.screen-tile video')?.videoWidth>0);
  const screen=b.locator('.screen-tile');await screen.locator('[data-tile-fullscreen]').click();
  await b.waitForFunction(()=>document.fullscreenElement?.id==='call-stage');
  const sizes=await b.evaluate(()=>{const screen=document.querySelector('.screen-tile').getBoundingClientRect(),camera=[...document.querySelectorAll('.call-tile:not(.screen-tile).video-enabled')].map(t=>t.getBoundingClientRect());return {width:screen.width,camera:camera.map(r=>({width:r.width,height:r.height,x:r.x}))};});
  assert.ok(sizes.width>800&&sizes.camera.every(r=>r.width>=250&&r.height>100),'Fullscreen must preserve visible cameras next to the screen');
  await b.getByLabel('Side by side',{exact:true}).check();await b.getByLabel('Camera size',{exact:true}).fill('400');
  await b.getByLabel('Camera overlay',{exact:true}).check();await b.screenshot({path:'output/playwright/call-screen-fullscreen.png'});
  await b.locator('#call-controls [data-action=call-fullscreen]').click();await b.waitForFunction(()=>!document.fullscreenElement);
  await screen.press('Enter');await b.waitForFunction(()=>document.fullscreenElement?.id==='call-stage');
  await b.locator('#call-controls [data-action=call-fullscreen]').click();
  await b.locator('#call-controls [data-action=call-pip]').click();
  await b.waitForFunction(()=>documentPictureInPicture.window?.document.querySelectorAll('video').length>=3);
  await b.waitForFunction(()=>[...documentPictureInPicture.window.document.querySelectorAll('video')].every(v=>v.videoWidth>0));
  await b.evaluate(()=>documentPictureInPicture.window.close());
  await a.locator('#call-controls [data-action=stop-share]').click();
  console.log('PASS visible fullscreen and PiP controls; fullscreen screen with cameras, side by side, Enter key, and decoded media in floating call window');
  if(process.env.QA_MOVIE==='1'){
   await b.locator('#call-controls [data-action=call-movies]').click();
   await b.locator('.call-movie-picker [data-play-id="outlaw-buddy"]').first().click();
   await b.waitForFunction(()=>{const v=document.querySelector('#vela-movie-player video');return v?.videoWidth>0&&v.currentTime>0;},null,{timeout:45000});
   await b.locator('[data-movie-fullscreen]').click();await b.waitForFunction(()=>document.fullscreenElement?.id==='call-stage');
   assert.ok(await b.locator('.call-tile.video-enabled').first().isVisible());
   await b.screenshot({path:'output/playwright/call-movie-fullscreen.png'});
   await b.locator('[data-movie-fullscreen]').click();await b.waitForFunction(()=>!document.fullscreenElement);
   await b.locator('#vela-movie-player video').press('Enter');await b.waitForFunction(()=>document.fullscreenElement?.id==='call-stage');
   await b.locator('[data-movie-fullscreen]').click();await b.locator('[data-movie-close]').click();
   console.log('PASS actual library movie decoded in the call; visible fullscreen button and Enter fullscreen keep cameras inside');
  }

 }

 await leave(a);await roster(caller,id,[fixture.users[recipient].uid]);await b.locator('#call-stage').waitFor();await a.locator('.join-active-call').waitFor();
 await a.reload();await a.locator('.app-shell').waitFor();await a.locator('.dm-row[data-open="'+cid+'"]').click();await a.locator('.join-active-call').waitFor();
 await a.locator('#conversation-call-presence').waitFor();assert.equal(await a.locator('#incoming-call .incoming-card').count(),0);assert.equal(await b.locator('#incoming-call .incoming-card').count(),0);
 await a.screenshot({path:'output/playwright/call-left-roster.png'});await b.screenshot({path:'output/playwright/call-remaining-participant.png'});
 for(let i=0;i<3;i++){
  const joining=i%2===0?a:b,remaining=i%2===0?b:a;
  await joining.locator('.join-active-call').click();await Promise.all([connected(joining),connected(remaining)]);
  await Promise.all([remoteFrames(a,fixture.users[recipient].uid),remoteFrames(b,fixture.users[caller].uid)]);
  assert.equal(await joining.locator('#incoming-call .incoming-card').count(),0);
  if(i<2)await leave(remaining);
 }
 console.log('PASS leaving either side keeps the same active call and named roster; repeated rejoining restores remote cameras with no incoming modal');
 for(const p of [a,b]){await p.locator('#call-controls [data-action=camera]').click();}
 for(const p of [a,b]){await p.locator('#call-controls [data-action=camera]').click();}
 await Promise.all([remoteFrames(a,fixture.users[recipient].uid),remoteFrames(b,fixture.users[caller].uid)]);
 if(new URL(site).hostname==='127.0.0.1'){
  const previous=devices.get(a).device;await a.evaluate(()=>window.__pixl.call.socket.close(4000,'QA transport reconnect'));
  await assertEventually(()=>assert.notEqual(devices.get(a).device,previous));await Promise.all([connected(a),connected(b)]);await Promise.all([remoteFrames(a,fixture.users[recipient].uid),remoteFrames(b,fixture.users[caller].uid)]);
  console.log('PASS signaling reconnect creates a fresh session and restores both remote cameras');
 }
 const oldDevice={...devices.get(a)};
 const c=await login(caller);await c.locator('.dm-row[data-open="'+cid+'"]').click();await c.locator('.join-active-call').click();await a.locator('#call-stage').waitFor({state:'hidden'});await Promise.all([connected(c),connected(b)]);
 await api(caller,'/calls/'+id+'/leave','POST',{device:oldDevice.device});await roster(caller,id,fixture.users.slice(0,2).map(u=>u.uid));
 await Promise.all([remoteFrames(c,fixture.users[recipient].uid),remoteFrames(b,fixture.users[caller].uid)]);
 console.log('PASS camera toggles on both sides; device handoff; delayed old-device leave cannot remove the new participant');
 await leave(c);await leave(b);await roster(caller,id,[]);await a.locator('#conversation-call-presence').waitFor({state:'hidden'});assert.equal(await a.locator('#incoming-call .incoming-card').count(),0);
 const preparing=crypto.randomUUID();await api(caller,'/calls/'+id+'/join','POST',{device:preparing});assert.equal((await api(recipient,'/calls/'+id)).call,null);
 assert.equal((await api(recipient,'/conversations/'+cid+'/calls','POST',{kind:'voice'})).call.id,id,'A pending join reserves its room without advertising a participant');
 await api(caller,'/calls/'+id+'/leave','POST',{device:preparing});
 await a.getByRole('button',{name:'Start Voice Call',exact:true}).click();await assertEventually(()=>assert.notEqual(devices.get(a).id,id));const fresh=devices.get(a).id;await b.locator('#incoming-call .incoming-card').waitFor();
 assert.equal((await api(caller,'/calls/'+fresh)).call.kind,'voice','An abandoned video call must not change a new voice call');
 if(process.env.QA_AGE_CHECK==='1'||process.env.QA_RING_CHECK==='1'){
  console.log('Checking real elapsed ringing timeout while preserving the occupied room...');
  const until=Date.now()+(process.env.QA_RING_CHECK==='1'?32000:95000);while(Date.now()<until)await new Promise(resolve=>setTimeout(resolve,Math.min(20000,until-Date.now())));
  await roster(recipient,fresh,[fixture.users[caller].uid]);await b.locator('.join-active-call').waitFor();await b.locator('#incoming-call .incoming-card').waitFor({state:'hidden',timeout:10000});
  assert.equal((await api(caller,'/calls/'+fresh)).call.status,'active');assert.equal(await a.locator('#call-stage.outgoing-ringing').count(),0);console.log('PASS ringing stops, incoming modal disappears, occupied call remains active and joinable');
 }
 await b.locator('.join-active-call').click();await Promise.all([connected(a),connected(b)]);await leave(a);await leave(b);await roster(recipient,fresh,[]);
 assert.deepEqual(errors,[]);console.log('PASS final departure removes active call and all incoming UI; zero browser page errors');
 fs.writeFileSync('output/playwright/call-presence-result.json',JSON.stringify({passed:true,site,at:new Date().toISOString(),ageCheck:process.env.QA_AGE_CHECK==='1',capture:'Browser test microphone/camera; real WebRTC transport and decoded remote frames',errors},null,2));
}catch(error){for(const [index,page]of pages.entries()){await page.screenshot({path:'output/playwright/call-presence-failure-'+index+'.png'}).catch(()=>{});console.error('Client '+index,await page.evaluate(()=>({toasts:window.qaToasts,call:window.__pixl?.call?.info,status:window.__pixl?.call?.status,peers:[...(window.__pixl?.call?.remote?.values()||[])].map(p=>({uid:p.uid,device:p.device,streams:Object.keys(p.streams)}))})).catch(()=>({})));}console.error('API failures',requests);throw error;}
finally{
 for(const {id,device,index}of devices.values())await api(index,'/calls/'+id+'/leave','POST',{device}).catch(()=>{});
 await browser.close();
 for(const group of groups)for(let i=0;i<2;i++)await api(i,'/conversations/'+group+'/leave','POST').catch(()=>{});
}
