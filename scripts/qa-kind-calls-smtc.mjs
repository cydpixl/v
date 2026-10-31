import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const site=process.env.QA_SITE||'https://cydpixl.github.io/v/';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const pages=[],errors=[];let callStarted=false;
fs.mkdirSync('output/playwright',{recursive:true});
try {
 for(let i=0;i<2;i++){
  const context=await browser.newContext({serviceWorkers:'block',permissions:['camera','microphone'],viewport:{width:i?1440:390,height:844},isMobile:!i,hasTouch:!i});
  if(!process.env.QA_SITE)await context.route('https://cydpixl.github.io/v/**',async route=>{const name=new URL(route.request().url()).pathname.slice(3)||'index.html';const file=path.resolve('dist-gh',name);if(!file.startsWith(path.resolve('dist-gh')+path.sep))throw Error('Invalid fixture path');await route.fulfill({path:file});});
  await context.addInitScript(()=>{localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1');localStorage.setItem('vela.callHeight','900px');});
  if(site.includes('127.0.0.1'))await context.route(new URL(site).origin+'/**',route=>route.continue({headers:{...route.request().headers(),origin:new URL(site).origin}}));
  if(site.includes('127.0.0.1'))await context.route('https://vela-cyd.cydpixl7.workers.dev/**',async route=>{try{const response=await route.fetch({headers:{...route.request().headers(),origin:'https://cydpixl.github.io'}});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':new URL(site).origin}});}catch{await route.abort().catch(()=>{});}});
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  await page.goto(site);await page.locator('[name=handle]').fill(qa.users[i].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.locator('.app-shell').waitFor();
  const cid=qa.users.map(u=>u.uid).sort().join(':');
  if(await page.getByRole('button',{name:'Show Navigation',exact:true}).isVisible())await page.getByRole('button',{name:'Show Navigation',exact:true}).click();
  await page.locator('.dm-row[data-open="'+cid+'"]').click();await page.locator('#composer').waitFor();
 }
 const [a,b]=pages,stamp=Date.now();
 await a.locator('#composer').fill(`QA ${stamp}: I appreciate you idiot retard. This is fucking amazing.`);await a.getByRole('button',{name:'Send Message',exact:true}).click();
 await a.locator('.message.pending').waitFor({state:'detached'});await b.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await b.locator('.message-text').filter({hasText:`QA ${stamp}: I appreciate you idiot retard. This is fucking amazing.`}).waitFor();
 console.log('PASS phone composer → recipient gets original, unmodified message');
 await a.getByRole('button',{name:'Start Video Call',exact:true}).click();callStarted=true;await b.locator('.join-active-call').click();
 for(const page of pages)await page.locator('#voice-dock strong').filter({hasText:'Voice Connected'}).waitFor();
 await a.waitForFunction(()=>[...document.querySelectorAll('.call-tile[data-self=false] video')].some(v=>v.videoWidth>0&&v.readyState>=2),null,{timeout:35000});
 for(const [width,height] of [[320,640],[390,844],[430,932],[844,390],[390,490],[768,1024],[1024,768]]){
  await a.setViewportSize({width,height});await a.waitForTimeout(250);
  const g=await a.evaluate(()=>{const r=s=>document.querySelector(s)?.getBoundingClientRect();return {stage:r('#call-stage')?.toJSON(),tile:r('.call-tile[data-self=false]')?.toJSON(),composer:r('#composer')?.toJSON(),controls:[...document.querySelectorAll('#call-controls [data-action=mute],#call-controls [data-action=camera],#call-controls [data-action=leave-call]')].map(e=>e.getBoundingClientRect().toJSON()),grip:getComputedStyle(document.querySelector('.call-resizer')).display,resized:document.querySelector('#call-stage').dataset.resized,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(g.grip,'none');assert.equal(g.resized,undefined);assert.equal(g.overflow,false);
  assert.ok(g.tile.height>=65,JSON.stringify({width,height,g}));assert.ok(g.composer.width>=100);assert.ok(g.composer.bottom<=height+1,JSON.stringify({width,height,g}));
  assert.ok(g.controls.every(r=>r.width>=40&&r.left>=0&&r.right<=width&&r.bottom<=height));
  if(width===390&&height===844)await a.screenshot({path:'output/playwright/mobile-call.png'});
 }
 console.log('PASS real incoming video and touch controls at 7 phone/tablet/keyboard viewports; saved desktop height ignored');
 await a.setViewportSize({width:390,height:844});await a.locator('.call-tile[data-self=false]').click();
 await a.locator('#call-controls [data-action=call-fullscreen]').click();await a.locator('#call-immersive').waitFor();
 await a.keyboard.press('Enter');assert.equal(await a.locator('.immersive-chat').isVisible(),false);
 await a.locator('.immersive-exit').click();await a.locator('#call-immersive').waitFor({state:'detached'});
 await a.evaluate(()=>{HTMLElement.prototype.requestFullscreen=undefined;});
 await a.locator('#call-controls [data-action=call-fullscreen]').click();await a.locator('#call-immersive.mobile-fullscreen').waitFor();await a.locator('.immersive-exit').click();
 console.log('PASS mobile fullscreen: no chat overlay; fallback works without element fullscreen');
 for(const page of pages)await page.locator('#call-controls [data-action=leave-call]').click();callStarted=false;
 const bridge=await browser.newPage({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36'});pages.push(bridge);
 let mode='playing',requests=0;
 const session=(title,source,status=4)=>({source_app_id:source,media_properties:{Title:title,Artist:'QA Artist'},playback_info:{PlaybackStatus:status},timeline_properties:{StartTime:0,EndTime:180000,Position:12000}});
 await bridge.route('http://127.0.0.1:5000/**',async route=>{requests++;if(mode==='offline')return route.abort();await route.fulfill({json:{current_session_id:'spotify',sessions:[session('Old Apple song','AppleInc.AppleMusicWin_nzyj5cx40ttqa!App',5),session('Current track','spotify',mode==='paused'?5:4)]},headers:{'access-control-allow-origin':'*'}});});
 await bridge.goto(site);await bridge.evaluate(()=>{document.body.innerHTML='<div class="app-shell"><aside class="sidebar"><div id="account-dock"><div class="self-profile"><small>bridge-test</small></div></div></aside></div>';localStorage.setItem('vela.smtc.v1.bridge-test',JSON.stringify({enabled:false,source:'apple'}));});
 // The app already loaded the integration, so use a fresh harness navigation.
 await bridge.route('**/bridge-harness',route=>route.fulfill({contentType:'text/html',body:'<div class="app-shell"><aside class="sidebar"><div id="account-dock"><div class="self-profile"><small>bridge-test</small></div></div></aside></div>'}));
 await bridge.goto(new URL('bridge-harness',site).href);await bridge.addScriptTag({content:fs.readFileSync('public/vela-smtc.js','utf8')});
 await bridge.locator('[data-smtc-title]').filter({hasText:'Current track'}).waitFor();assert.ok(requests>0);
 await bridge.locator('[data-smtc-settings]').click();assert.equal(await bridge.locator('[data-smtc-source]').inputValue(),'any');assert.equal(await bridge.locator('[data-smtc-share]').isChecked(),false);
 assert.equal(await bridge.locator('.vela-smtc-settings-body input:not([type=checkbox])').count(),0);
 mode='offline';await bridge.locator('[data-smtc-connect]').click();await bridge.getByText('Waiting for SMTC Bridge',{exact:true}).first().waitFor();
 mode='playing';await bridge.evaluate(()=>window.dispatchEvent(new Event('focus')));await bridge.locator('[data-smtc-title]').filter({hasText:'Current track'}).waitFor();await bridge.waitForFunction(()=>!document.querySelector('.vela-smtc-song').hidden);
 await bridge.locator('[data-smtc-disconnect]').click();await bridge.reload();await bridge.addScriptTag({content:fs.readFileSync('public/vela-smtc.js','utf8')});
 assert.equal(await bridge.locator('[data-smtc-status]').textContent(),'Automatic detection off');
 console.log('PASS bridge auto-connect, old-settings migration, current player, recovery, private default and persisted opt-out');
 assert.deepEqual(errors,[]);console.log('PASS zero app page errors');
} catch(error) {
 for(const [i,page] of pages.entries()) {await page.screenshot({path:`output/playwright/kind-call-failure-${i}.png`}).catch(()=>{});console.log('DIAGNOSTIC',i,await page.locator('.toast,#outbox-status,.message-text').allTextContents().catch(()=>[]));}
 throw error;
} finally {
 if(callStarted)for(const page of pages.slice(0,2))await page.locator('#call-controls [data-action=leave-call]').click({timeout:3000}).catch(()=>{});
 await browser.close();
}
