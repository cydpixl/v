import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const site=process.env.QA_SITE||'https://cydpixl.github.io/v/',backend='https://vela-cyd.cydpixl7.workers.dev';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8')),cid=qa.users.slice(0,2).map(u=>u.uid).sort().join(':'),id=crypto.randomUUID();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const pages=[],tokens=[],errors=[];let created=false,calling=false;
fs.mkdirSync('output/playwright',{recursive:true});
const track={title:'Shared Listening · One',artist:'VELA player verification',album:'Saved in this chat',duration:210000,position:40000,playing:true};
const marker=t=>'[[vela-live-music:1:'+Buffer.from(JSON.stringify({...t,at:t.at??Date.now()})).toString('base64url')+']]';
async function api(endpoint,method='GET',body){const response=await fetch(backend+'/api'+endpoint,{method,headers:{Authorization:tokens[0],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const result=await response.json();assert.ok(response.ok,result.error||response.status);return result;}
async function chat(page){if(await page.getByRole('button',{name:'Show Navigation',exact:true}).isVisible())await page.getByRole('button',{name:'Show Navigation',exact:true}).click();await page.locator('.dm-row[data-open="'+cid+'"]').click();await page.locator('#composer').waitFor();}
try{
 for(let i=0;i<2;i++){
  const context=await browser.newContext({permissions:['camera','microphone'],serviceWorkers:'block',viewport:{width:i?390:1440,height:i?844:1000},isMobile:!!i,hasTouch:!!i});
  if(!process.env.QA_SITE)await context.route('https://cydpixl.github.io/v/**',route=>route.fulfill({path:path.resolve('dist-gh',new URL(route.request().url()).pathname.slice(3)||'index.html')}));
  await context.route('http://127.0.0.1:5000/**',route=>route.fulfill({json:{current_session_id:null,sessions:[]},headers:{'access-control-allow-origin':'*'}}));
  await context.addInitScript(()=>{localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1');});
  const page=await context.newPage();pages.push(page);page.setDefaultTimeout(35000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const authorization=r.headers().authorization;if(r.url().startsWith(backend+'/api/')&&authorization)tokens[i]=authorization;});
  await page.goto(site);await page.locator('[name=handle]').fill(qa.users[i].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.locator('.app-shell').waitFor();await chat(page);
 }
 const [a,b]=pages;
 await api('/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id,text:marker(track)});created=true;await api('/messages/'+id,'PATCH',{pinned:true});
 for(const page of pages){await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.locator('#live-music-dock [data-vlm-title]').filter({hasText:track.title}).waitFor();}
 await b.waitForFunction(()=>document.querySelector('#live-music-dock [data-live-pin]')?.getAttribute('aria-pressed')==='true');
 await b.locator('#message-scroll').evaluate(el=>el.scrollTop=0);
 const position=await b.locator('#live-music-dock').boundingBox();assert.ok(position.y>0&&position.y+position.height<700);
 assert.equal(await b.locator('#live-music-dock [data-live-pin]').getAttribute('aria-pressed'),'true');
 console.log('PASS pinned live player stays above a scrolling phone conversation');
 // Emulate a history page which no longer contains the original music message.
 await b.context().route(backend+'/api/conversations/'+encodeURIComponent(cid)+'/messages*',async route=>{try{if(route.request().method()!=='GET'||new URL(route.request().url()).searchParams.has('pins'))return await route.continue();const response=await route.fetch(),data=await response.json();data.messages=data.messages.filter(m=>m.id!==id);await route.fulfill({response,json:data});}catch{await route.abort().catch(()=>{});}});
 await b.reload();await b.locator('.app-shell').waitFor();await chat(b);await b.locator('#live-music-dock [data-vlm-title]').filter({hasText:track.title}).waitFor();assert.equal(await b.locator('[data-message="'+id+'"]').count(),0);
 console.log('PASS pinned player survives reload independently of the latest history page');
 await a.evaluate(uid=>localStorage.removeItem('vela.music.live-messages.'+uid),qa.users[0].uid);await a.reload();await a.locator('.app-shell').waitFor();await chat(a);
 await a.waitForFunction(({uid,id})=>JSON.parse(localStorage.getItem('vela.music.live-messages.'+uid)||'[]').some(m=>m.id===id),{uid:qa.users[0].uid,id});
 const second={...track,title:'Shared Listening · Two',position:12000};await a.evaluate(t=>window.velaMusic.syncLive(t),second);
 await b.locator('#live-music-dock [data-vlm-title]').filter({hasText:second.title}).waitFor();
 const before=(await api('/live-music-shares')).messages.map(m=>m.id).sort();
 await a.evaluate(t=>window.velaMusic.sendLive(t),{...second,title:'Shared Listening · Three'});
 await b.locator('#live-music-dock [data-vlm-title]').filter({hasText:'Shared Listening · Three'}).waitFor();
 assert.deepEqual((await api('/live-music-shares')).messages.map(m=>m.id).sort(),before);
 console.log('PASS server recovery after clearing local records; track changes update the same saved message; repeat Send creates no duplicate');
 await a.evaluate(t=>window.velaMusic.syncLive(t),{...second,title:'Shared Listening · Three',playing:false});
 await b.waitForFunction(()=>document.querySelector('#live-music-dock [data-vlm-status]')?.textContent==='PAUSED');
 await a.locator('#workspace-header [data-action=pins]').click();await a.locator('dialog[open] .vela-live-music').first().waitFor();assert.ok(!(await a.locator('dialog[open]').innerText()).includes('[[vela-live-music:'));await a.locator('dialog[open] [aria-label=Close]').click();
 console.log('PASS paused status and rich live cards in Pinned Messages');
 for(const [width,height] of [[320,640],[390,844],[844,390],[390,490]]){await b.setViewportSize({width,height});const g=await b.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,player:document.querySelector('#live-music-dock').getBoundingClientRect().toJSON(),composer:document.querySelector('#composer').getBoundingClientRect().toJSON()}));assert.equal(g.overflow,false);assert.ok(g.player.bottom<g.composer.top);assert.ok(g.composer.bottom<=height+1);}
 await b.setViewportSize({width:390,height:844});await a.screenshot({path:'output/playwright/live-player-desktop.png'});await b.screenshot({path:'output/playwright/live-player-mobile.png'});
 await a.getByRole('button',{name:'Start Video Call',exact:true}).click();calling=true;await b.locator('.join-active-call').click();
 for(const page of pages)await page.locator('#voice-dock strong').filter({hasText:'Voice Connected'}).waitFor();
 await b.waitForFunction(()=>[...document.querySelectorAll('.call-tile[data-self=false] video')].some(v=>v.videoWidth>0&&v.readyState>=2));
 for(const [width,height] of [[320,640],[390,844],[844,390],[390,490]]){await b.setViewportSize({width,height});await b.waitForTimeout(200);const g=await b.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,player:document.querySelector('#live-music-dock').getBoundingClientRect().toJSON(),tile:document.querySelector('.call-tile[data-self=false]').getBoundingClientRect().toJSON(),composer:document.querySelector('#composer').getBoundingClientRect().toJSON()}));assert.equal(g.overflow,false);assert.ok(g.tile.height>=65,JSON.stringify({width,height,g}));assert.ok(g.player.bottom<g.composer.top);assert.ok(g.composer.bottom<=height+1,JSON.stringify({width,height,g}));}
 await b.setViewportSize({width:390,height:844});await b.screenshot({path:'output/playwright/live-player-mobile-call.png'});for(const page of pages)await page.locator('#call-controls [data-action=leave-call]').click();calling=false;
 console.log('PASS persistent player with decoded remote video and reachable composer at four phone/keyboard/landscape sizes');
 await b.locator('#live-music-dock [data-live-pin]').click();await b.waitForFunction(()=>document.querySelector('#live-music-dock [data-live-pin]')?.getAttribute('aria-pressed')==='false');
 assert.equal((await api('/conversations/'+encodeURIComponent(cid)+'/live-music')).messages.find(m=>m.id===id).pinned,0);
 await api('/messages/'+id,'PATCH',{text:marker({...track,at:Date.now()-86400000,playing:false})});await api('/messages/'+id,'PATCH',{pinned:true});
 await b.waitForFunction(()=>document.querySelector('#live-music-dock [data-live-pin]')?.getAttribute('aria-pressed')==='true');assert.equal(await b.locator('#live-music-dock').isVisible(),true);
 console.log('PASS pin/unpin persists on the server; pinned player remains even after listening ends');
 assert.deepEqual(errors,[]);console.log('PASS zero app page errors');
}catch(error){for(const [i,page]of pages.entries())await page.screenshot({path:`output/playwright/live-player-failure-${i}.png`}).catch(()=>{});throw error;}
finally{if(calling)for(const page of pages)await page.locator('#call-controls [data-action=leave-call]').click({timeout:3000}).catch(()=>{});for(const page of pages)await page.context().unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});if(created)await api('/messages/'+id,'DELETE').catch(()=>{});await browser.close();}
