import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS||'.private/qa.json','utf8'));
const site=process.env.QA_SITE||'https://cydpixl.github.io/v/';
const output=path.resolve(process.env.QA_OUTPUT||'output/native-library');fs.mkdirSync(output,{recursive:true});
const local=process.env.QA_LOCAL==='1',base='https://vela-cyd.cydpixl7.workers.dev/api';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const pages=[],errors=[],checks=[],decoded=[];let token,callStarted=false;
const pass=message=>{checks.push(message);console.log('PASS',message)};
const bounds=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
try{
 for(let i=0;i<2;i++){
  const ctx=await browser.newContext({viewport:{width:1536,height:960},permissions:['microphone','camera'],serviceWorkers:'block'});
  await ctx.addInitScript(()=>{localStorage.setItem('vela.theme','midnight');localStorage.setItem('vela.theme.chosen','1');localStorage.setItem('vela.sidebar.width','260')});
  if(local)await ctx.route('https://cydpixl.github.io/v/**',async route=>{
   const url=new URL(route.request().url()),relative=decodeURIComponent(url.pathname.slice('/v/'.length))||'index.html';
   const root=path.resolve('dist-gh'),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))return route.abort();
   if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'}[path.extname(file)];
   await route.fulfill({status:200,contentType:type||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const p=await ctx.newPage();pages.push(p);p.setDefaultTimeout(30000);p.on('pageerror',err=>errors.push(err.message));
  p.on('request',r=>{if(i===0&&r.url().startsWith(base))token=r.headers().authorization||token});
  await p.goto(site);await p.locator('[name=handle]').fill(qa.users[i].handle);await p.locator('[name=password]').fill(qa.password);await p.getByRole('button',{name:'Log In',exact:true}).click();
  const cid=[qa.users[0].uid,qa.users[1].uid].sort().join(':');await p.locator('.dm-row[data-open="'+cid+'"]').click();
 }
 const [a,b]=pages;
 const headers=()=>({Authorization:token,Origin:'https://cydpixl.github.io'});
 const response=await a.request.get(base+'/movies',{headers:headers()});assert.ok(response.ok());const catalog=await response.json();
 const playable=catalog.library.filter(x=>x.playback!=='youtube'&&x.listed!==false),legacy=catalog.library.find(x=>x.playback==='youtube');
 if(!local){assert.equal(catalog.library.length,playable.length,'API must exclude YouTube-only entries');pass('Live API exposes only direct media files');}
 await a.locator('#composer').fill('Draft stays while the sidebar changes');
 await a.getByRole('button',{name:'Start Voice Call',exact:true}).click();callStarted=true;
 await b.locator('#workspace-header .join-active-call').click();
 for(const p of pages)await p.locator('#voice-dock strong').filter({hasText:'Voice Connected'}).waitFor({timeout:45000});
 const grip=a.getByRole('separator',{name:'Resize navigation',exact:true});
 for(const width of [220,260,420,260]){
  await grip.focus();const current=Number(await grip.getAttribute('aria-valuenow'));
  for(let n=0;n<Math.abs(width-current)/10;n++)await grip.press(width<current?'ArrowLeft':'ArrowRight');
  const boxes=await a.evaluate(()=>{const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const sidebar=document.querySelector('.sidebar'),voice=document.querySelector('#voice-dock'),account=document.querySelector('#account-dock');return {sidebar:rect(sidebar),voice:rect(voice),account:rect(account),position:getComputedStyle(voice).position,controls:[...voice.querySelectorAll('button')].map(rect)}});
  assert.equal(Math.round(boxes.sidebar.width),width);assert.equal(boxes.position,'static');
  assert.ok(boxes.voice.left>=boxes.sidebar.left&&boxes.voice.right<=boxes.sidebar.right,'Voice dock stays inside navigation');
  assert.ok(boxes.voice.bottom<=boxes.account.top,'Voice and account controls do not overlap');
  for(const control of boxes.controls)assert.ok(control.left>=boxes.voice.left&&control.right<=boxes.voice.right,'Every voice button fits');
 }
 assert.equal(await a.locator('#composer').innerText(),'Draft stays while the sidebar changes');
 await a.screenshot({path:path.join(output,'vela-fixed-call-panel.png')});
 await a.screenshot({path:path.join(output,'vela-fixed-call-panel-detail.png'),clip:{x:64,y:630,width:800,height:330}});
 pass('Real two-account voice call; panel fits 220/260/420px navigation without overlap or lost drafts');
 await a.locator('#voice-dock [data-action=call-movies]').click();await a.locator('[data-movie-tab=watch]').click();await a.locator('.vela-library').waitFor();
 assert.equal(await a.getByRole('combobox',{name:'Playback source',exact:true}).count(),0);
 assert.ok(!(await a.locator('.vela-library').innerText()).includes('YouTube'));
 const titles=playable.filter(x=>['bodycam','daily-dose'].includes(x.category));assert.ok(titles.length>=5);
 for(const item of titles){
  console.log('CHECK playback',item.title);
  await a.locator('[data-library-filter="'+item.category+'"]').click();
  await a.locator('[data-play-id="'+item.id+'"]').click();
  for(const p of pages)await p.waitForFunction(()=>{const v=document.querySelector('#vela-movie-player video');return v?.videoWidth>0&&v.videoHeight>0&&v.readyState>=2&&!v.paused&&v.currentTime>0.3},null,{timeout:90000});
  const media=await a.locator('#vela-movie-player video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,paused:v.paused}));decoded.push({id:item.id,title:item.title,...media});
  assert.equal(await b.locator('#vela-movie-player header strong').innerText(),item.title);
  console.log('PASS decoded on both accounts',item.title,media.width+'×'+media.height);
  assert.equal(await a.locator('iframe[src*="youtube"],script[src*="youtube.com"]').count(),0);
  if(decoded.length===1){
   await a.getByRole('button',{name:'Pause movie',exact:true}).click();await b.waitForFunction(()=>document.querySelector('#vela-movie-player video')?.paused);
   await a.getByRole('slider',{name:'Movie position',exact:true}).fill('45');await b.waitForFunction(()=>Math.abs(document.querySelector('#vela-movie-player video')?.currentTime-45)<1.5);
   await a.screenshot({path:path.join(output,'vela-direct-bodycam.png')});pass('Direct bodycam plays on both accounts; pause and seeking synchronize without YouTube');
  }
  if(item.category==='daily-dose')await a.screenshot({path:path.join(output,'vela-direct-daily-dose.png')});
  await a.getByRole('button',{name:'Close movie',exact:true}).click();
  await b.locator('#vela-movie-player').waitFor({state:'detached'});
  if(item!==titles.at(-1)){await a.locator('#voice-dock [data-action=call-movies]').click();await a.locator('[data-movie-tab=watch]').click();}
 }
 pass('Every retained bodycam and Daily Dose video decodes on both accounts: '+decoded.length+' files');
 for(const p of pages)await p.locator('#voice-dock [data-action=leave-call]').click();callStarted=false;
 await a.locator('#voice-dock').waitFor({state:'hidden'});await a.getByRole('button',{name:'Library',exact:true}).click();await a.locator('[data-movie-tab=watch]').click();
 await a.locator('[data-library-filter=bodycam]').click();assert.equal(await a.locator('.vela-library .cinema-tile').count(),playable.filter(x=>x.category==='bodycam').length);
 await a.screenshot({path:path.join(output,'vela-native-library.png')});pass('Hangup hides voice controls; Library shows only retained native bodycam files');
 if(!local){
  for(const item of playable){const r=await a.request.post(base+'/movies/'+encodeURIComponent(item.id)+'/play',{headers:headers()});assert.ok(r.ok(),item.title);const link=await r.json();assert.ok(link.url&&!link.provider,item.title);const range=await a.request.get(link.url,{headers:{Range:'bytes=0-1023'}});assert.equal(range.status(),206,item.title);assert.ok((await range.body()).length>0,item.title);}
  const legacyId='youtube-30cac4408f355c7e531c4ac4';const r=await a.request.post(base+'/movies/'+legacyId+'/play',{headers:headers()});assert.equal(r.status(),404);
  pass('All '+playable.length+' library sources return native media tickets and seekable byte ranges; legacy YouTube ID blocked');
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'vela-native-qa.json'),JSON.stringify({site,local,passed:true,checks,decoded,libraryCount:playable.length,errors},null,2));
}catch(error){for(const[i,p]of pages.entries())await p.screenshot({path:path.join(output,'native-failure-'+i+'.png')}).catch(()=>{});throw error;}
finally{if(callStarted)for(const p of pages)await p.locator('#voice-dock [data-action=leave-call]').click({timeout:3000}).catch(()=>{});await browser.close();}
