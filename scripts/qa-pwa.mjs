import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8'));
const site=process.env.QA_SITE||'http://127.0.0.1:5198/';
const browser=await (process.env.QA_WEBKIT?webkit:chromium).launch(process.env.QA_WEBKIT?{headless:true}:{channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const contexts=[],pages=[],errors=[],passes=[];
fs.mkdirSync('output/playwright',{recursive:true});
const pass=name=>{passes.push(name);console.log('PASS',name);};
async function contextFor(index,mobile,blockedStorage=false){
 const context=await browser.newContext({permissions:process.env.QA_WEBKIT?[]:['microphone','camera'],viewport:{width:mobile?390:1536,height:844},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});contexts.push(context);
 await context.addInitScript(()=>{window.qaToasts=[];new MutationObserver(()=>{for(const t of document.querySelectorAll('.toast'))if(!window.qaToasts.includes(t.textContent))window.qaToasts.push(t.textContent)}).observe(document,{childList:true,subtree:true});localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1')});
 if(site.includes('127.0.0.1'))await context.route('https://vela-cyd.cydpixl7.workers.dev/**',async route=>{try{const response=await route.fetch({headers:{...route.request().headers(),origin:'https://cydpixl.github.io'}});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':new URL(site).origin}});}catch{await route.abort().catch(()=>{});}});
 if(blockedStorage)await context.addInitScript(()=>{const open=indexedDB.open.bind(indexedDB);indexedDB.open=(name,...args)=>{if(name==='vela-upload-queue')throw new DOMException('QA storage unavailable','UnknownError');return open(name,...args);};});
 const page=await context.newPage();pages.push(page);page.setDefaultTimeout(35000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(site);await page.locator('[name=handle]').fill(qa.users[index].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.locator('.sidebar-tools').waitFor({state:'attached'});
 return page;
}
async function openChat(page,cid){if(await page.getByRole('button',{name:'Show Navigation',exact:true}).isVisible())await page.getByRole('button',{name:'Show Navigation',exact:true}).click();await page.locator('.dm-row[data-open="'+cid+'"]').click();await page.locator('#composer').waitFor();await page.waitForTimeout(220);}
async function uploads(page){await page.getByRole('button',{name:'Attach a File',exact:true}).click();await page.getByRole('menuitem',{name:'Uploads',exact:true}).click();return page.getByRole('dialog',{name:'Uploads',exact:true});}
async function close(page,name){await page.getByRole('dialog',{name,exact:true}).getByRole('button',{name:'Close',exact:true}).click();}
try{
 const a=await contextFor(0,true),b=await contextFor(1,false),cid=[qa.users[0].uid,qa.users[1].uid].sort().join(':');
 await openChat(a,cid);await openChat(b,cid);
 for(const width of [320,390,430,650,768,899,900,1024,1099,1100,1200,1536]){
  await a.setViewportSize({width,height:844});await a.waitForTimeout(200);
  const geometry=await a.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,composer:document.querySelector('#composer').getBoundingClientRect().width,header:[...document.querySelectorAll('#workspace-header button')].filter(x=>x.getBoundingClientRect().width).every(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})}));
  assert.equal(geometry.scroll,width,`horizontal overflow at ${width}`);assert.ok(geometry.composer>=120,`typing space at ${width}: ${geometry.composer}`);assert.ok(geometry.header,`header buttons fit at ${width}`);
  if([390,768,1536].includes(width))await a.screenshot({path:`output/playwright/pwa-${width}.png`});
 }
 pass('320–1536px: no horizontal overflow, usable typing space, visible header actions');
 await a.setViewportSize({width:390,height:844});await a.locator('#composer').fill('PWA draft remains intact');
 await a.getByRole('button',{name:'Show Navigation',exact:true}).click();assert.equal(await a.locator('.sidebar').evaluate(x=>x.inert),false);
 await a.locator('.dm-row[data-open="'+cid+'"]').click();await a.waitForTimeout(200);assert.equal(await a.locator('.sidebar').evaluate(x=>x.inert),true);assert.equal(await a.locator('#composer').innerText(),'PWA draft remains intact');
 await a.locator('#composer').focus();await a.setViewportSize({width:390,height:490});await a.waitForTimeout(100);
 assert.ok(await a.getByRole('button',{name:'Send Message',exact:true}).evaluate(x=>x.getBoundingClientRect().bottom<=innerHeight));assert.equal(await a.locator('#composer').innerText(),'PWA draft remains intact');
 await a.setViewportSize({width:390,height:844});pass('Navigation closes even for the current chat; keyboard-sized viewport keeps Send and draft');
 await a.getByRole('button',{name:'Attach a File',exact:true}).click();await a.getByRole('menuitem',{name:'Schedule message',exact:true}).click();await a.getByRole('dialog',{name:'Schedule message',exact:true}).waitFor();
 assert.ok(await a.locator('#schedule-time').evaluate(x=>parseFloat(getComputedStyle(x).fontSize)>=16));await close(a,'Schedule message');
 await a.getByRole('button',{name:'Add Emoji',exact:true}).click();await a.locator('.expression-picker').waitFor();await a.keyboard.press('Escape');
 await a.getByRole('button',{name:'Conversation Options',exact:true}).click();await a.getByRole('menuitem',{name:'Shared media',exact:true}).click();await a.getByRole('dialog',{name:'Shared media',exact:true}).waitFor();await close(a,'Shared media');
 await a.getByRole('button',{name:'Show Navigation',exact:true}).click();await a.getByRole('button',{name:'User Settings',exact:true}).click();
 await a.getByRole('button',{name:'Voice & Video',exact:true}).click();assert.equal(await a.locator('.desktop-settings').evaluate(x=>x.scrollWidth<=x.clientWidth+1),true);await a.screenshot({path:'output/playwright/pwa-settings.png'});await close(a,'Account');
 await openChat(a,cid);pass('Schedule, expressions, shared media, and settings remain reachable on mobile');
 const stamp=Date.now(),name='pwa-upload-'+stamp+'.txt',photo='pwa-photo-'+stamp+'.png';
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=','base64');
 await a.locator('#file-input').setInputFiles([{name,mimeType:'text/plain',buffer:Buffer.from('PWA byte verified '+stamp)},{name:photo,mimeType:'image/png',buffer:image}]);
 await a.getByRole('button',{name:'Send Message',exact:true}).waitFor({state:'visible'});await a.locator('.attachment-preview').filter({hasText:name}).waitFor();await a.locator('.attachment-preview').filter({hasText:photo}).waitFor();
 await a.getByRole('button',{name:'Remove '+photo,exact:true}).click();assert.equal(await a.locator('.attachment-preview').count(),1);
 await a.getByRole('button',{name:'Send Message',exact:true}).click();await a.locator('.message').filter({hasText:name}).waitFor();
 // Local browser tests cannot authenticate WebSocket Origin overrides; reload the receiver.
 if(site.includes('127.0.0.1')){await b.reload();await b.locator('.sidebar-tools').waitFor({state:'attached'});await openChat(b,cid);}
 const received=b.getByRole('link').filter({hasText:name});await received.waitFor();
 const response=await b.context().request.get(await received.getAttribute('href'),{headers:{origin:'https://cydpixl.github.io'}});assert.equal(await response.text(),'PWA byte verified '+stamp);
 pass('Real multipart multi-file upload, individual removal, sending, and exact recipient bytes');
 if(!process.env.QA_WEBKIT||process.env.QA_FULL_UPLOADS==='1'){
  const failed='pwa-retry-'+stamp+'.txt',pattern=/\/api\/chat-uploads\/[^/]+\/part\?n=1/;
  await a.route(pattern,route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'QA interruption'})}));
  await a.locator('#file-input').setInputFiles({name:failed,mimeType:'text/plain',buffer:Buffer.from('retry payload')});await a.getByRole('button',{name:'Resume / Retry',exact:true}).waitFor();assert.equal(await a.getByRole('button',{name:'Send Message',exact:true}).isEnabled(),true);
  await a.unroute(pattern);await a.getByRole('button',{name:'Resume / Retry',exact:true}).click();let panel=a.getByRole('dialog',{name:'Uploads',exact:true});await panel.locator('.queue-job').filter({hasText:failed}).getByRole('button',{name:'Retry',exact:true}).click();await a.locator('.attachment-preview').filter({hasText:failed}).waitFor();await close(a,'Uploads');
  assert.equal(await a.getByRole('button',{name:'Resume / Retry',exact:true}).count(),0);await a.getByRole('button',{name:'Remove '+failed,exact:true}).click();pass('Permanent upload error releases Send; Retry resumes the same job and clears failure status');
  const resume='pwa-resume-'+stamp+'.txt',part2=/\/api\/chat-uploads\/[^/]+\/part\?n=2/;let hit;const reached=new Promise(resolve=>hit=resolve);
  await a.route(part2,async route=>{hit();await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA disconnect'})});});
  await a.locator('#file-input').setInputFiles({name:resume,mimeType:'text/plain',buffer:Buffer.alloc(17*1024**2,97)});await reached;
  await a.getByRole('button',{name:'Manage',exact:true}).click();panel=a.getByRole('dialog',{name:'Uploads',exact:true});await panel.locator('.queue-job').filter({hasText:resume}).getByRole('button',{name:'Pause',exact:true}).click();assert.equal(await a.getByRole('button',{name:'Send Message',exact:true}).isEnabled(),true);
  await a.reload();await a.locator('.sidebar-tools').waitFor({state:'attached'});await a.unroute(part2);await openChat(a,cid);panel=await uploads(a);await panel.locator('.queue-job').filter({hasText:resume}).getByRole('button',{name:'Resume',exact:true}).click();await a.locator('.attachment-preview').filter({hasText:resume}).waitFor();await close(a,'Uploads');
  await a.getByRole('button',{name:'Send Message',exact:true}).click();await a.locator('.message').filter({hasText:resume}).waitFor();pass('17 MB upload pauses after part 1, survives reload, resumes server checkpoints, and sends');
 }
 if(!process.env.QA_WEBKIT&&process.env.QA_CALL==='1'){
  await a.getByRole('button',{name:'Start Video Call',exact:true}).click();await b.getByRole('button',{name:'Join Call',exact:true}).first().click();
  await b.waitForFunction(uid=>[...document.querySelectorAll('#call-stage [data-participant="'+uid+'"] video')].some(v=>v.videoWidth>0&&v.readyState>=2),qa.users[0].uid);
  await a.waitForFunction(uid=>[...document.querySelectorAll('#call-stage [data-participant="'+uid+'"] video')].some(v=>v.videoWidth>0&&v.readyState>=2),qa.users[1].uid);
  assert.ok(await a.getByRole('button',{name:'Send Message',exact:true}).evaluate(x=>x.getBoundingClientRect().bottom<=innerHeight));
  await a.screenshot({path:'output/playwright/pwa-video-call.png'});
  for(const page of [a,b])await page.locator('#call-controls [data-action=leave-call]').click();
  pass('Two-account WebRTC decodes video; mobile chat and Send remain visible during the call');
 }
 const c=await contextFor(0,true,true);await openChat(c,cid);await c.locator('#composer').fill('PWA text works with unavailable upload storage '+stamp);await c.getByRole('button',{name:'Send Message',exact:true}).click();await c.locator('.message').filter({hasText:'PWA text works with unavailable upload storage '+stamp}).waitFor();pass('Unavailable upload storage does not block sign-in or text messaging');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,engine:process.env.QA_WEBKIT?'webkit':'chromium',passes,errors}));
}catch(error){for(const [i,page]of pages.entries())await page.screenshot({path:`output/playwright/pwa-failure-${i}.png`}).catch(()=>{});console.log('PAGE ERRORS',errors);for(const p of pages)console.log('TOASTS',await p.evaluate(()=>window.qaToasts));throw error;}
finally{for(const page of pages){const leave=page.locator('#call-controls [data-action=leave-call]');if(await leave.isVisible())await leave.click({timeout:3000}).catch(()=>{});}for(const context of contexts)await context.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});await browser.close();}
