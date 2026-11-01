import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS||'.private/qa.json','utf8')),site=process.env.QA_SITE||'http://127.0.0.1:5196/',backend='https://vela-cyd.cydpixl7.workers.dev',local='http://127.0.0.1:8796',cid=qa.users.slice(0,2).map(u=>u.uid).sort().join(':'),output=path.resolve('output/playwright/music-ui');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),pages=[],tokens=[],created=[],errors=[],historyCreated=[],priorSharing=[];
const pass=name=>console.log('PASS:',name);
async function liveAPI(path,method='GET',body,index=0){const response=await fetch(backend+'/api'+path,{method,headers:{Authorization:tokens[index],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.ok(response.ok,data.error||response.status);return data;}
async function historyAPI(uid,path='',method='GET',body){const response=await fetch(local+'/api/listening-history'+path,{method,headers:{Authorization:'Bearer test:'+uid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.ok(response.ok,data.error||response.status);return data;}
async function chat(page){const nav=page.getByRole('button',{name:'Show Navigation',exact:true});if(await nav.isVisible())await nav.click();await page.locator('.dm-row[data-open="'+cid+'"]').click();await page.locator('#composer').waitFor();}
try{
 if(process.env.QA_REAL_HISTORY!=='1')await historyAPI('listener-one','','POST',{shared:true,track:{id:crypto.randomUUID(),title:'luther',artist:'Kendrick Lamar',album:'GNX'}});
 if(process.env.QA_REAL_HISTORY!=='1')await historyAPI('listener-two','','POST',{shared:true,track:{id:crypto.randomUUID(),title:'Snooze',artist:'SZA',album:'SOS'}});
 for(let i=0;i<2;i++){console.log('Opening QA session',i);
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  if(process.env.QA_BUNDLE==='1')await context.route('https://cydpixl.github.io/v/**',route=>route.fulfill({path:path.resolve('dist-gh',new URL(route.request().url()).pathname.slice(3)||'index.html')}));
  await context.addInitScript(()=>{localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1');});
  if(process.env.QA_REAL_HISTORY!=='1')await context.route(backend+'/**',async route=>{try{
   const history=process.env.QA_REAL_HISTORY!=='1'&&route.request().url().includes('/api/listening-history');
   const request=route.request(),response=await route.fetch({...(history?{url:local+new URL(request.url()).pathname+new URL(request.url()).search}:{}),headers:{...request.headers(),origin:'https://cydpixl.github.io',...(history?{authorization:'Bearer test:'+(i?'listener-two':'listener-one')}:{})}});
   await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':new URL(site).origin}});
  }catch{await route.abort().catch(()=>{});}});
  await context.route('http://127.0.0.1:5000/**',route=>route.fulfill({json:{current_session_id:'apple',sessions:[{source_app_id:'apple',media_properties:{Title:'luther',Artist:'Kendrick Lamar',AlbumTitle:'GNX'},playback_info:{PlaybackStatus:4},timeline_properties:{StartTime:0,EndTime:177000,Position:24000}}]},headers:{'access-control-allow-origin':'*'}}));
  const page=await context.newPage();pages.push(page);page.setDefaultTimeout(35000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().startsWith(backend+'/api/')&&request.headers().authorization)tokens[i]=request.headers().authorization;if(process.env.QA_REAL_HISTORY==='1'&&request.url().includes('/api/listening-history')&&request.method()==='POST'){const data=request.postDataJSON();if(data?.track?.id)historyCreated.push({uid:qa.users[i].uid,id:data.track.id});}});
  await page.goto(site,{waitUntil:'domcontentloaded'});console.log('Login page loaded',i);await page.locator('[name=handle]').fill(qa.users[i].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.getByRole('button',{name:'Tools & uploads',exact:true}).waitFor();await chat(page);console.log('Chat loaded',i);
 }
 if(process.env.QA_REAL_HISTORY==='1')for(let i=0;i<2;i++){
  priorSharing[i]=(await liveAPI('/listening-history','GET',undefined,i)).sharing;
  await liveAPI('/listening-history','POST',{shared:true},i);
  const id=crypto.randomUUID();await liveAPI('/listening-history','POST',{shared:true,track:{id,title:i?'Snooze':'luther',artist:i?'SZA':'Kendrick Lamar',album:i?'SOS':'GNX'}},i);historyCreated.push({uid:qa.users[i].uid,id});
 }
 const [a,b]=pages;console.log('Checking Music page');
 await a.locator('#composer').fill('Draft stays while sharing a song');
 await a.locator('#composer-form .vela-smtc-card:not([hidden])').waitFor();assert.equal(await a.locator('.sidebar .vela-smtc-card').count(),0);
 const visibleTools=await a.locator('.composer>.icon-button').evaluateAll(nodes=>nodes.filter(node=>getComputedStyle(node).display!=='none').map(node=>node.getAttribute('aria-label')));assert.deepEqual(visibleTools,['Attach a File','Send music','Add Emoji','Send Message']);
 await a.locator('[data-action=music]').click();await a.getByRole('heading',{name:'Music',exact:true}).waitFor();await a.locator('.music-browse-track').first().waitFor();
 await a.getByRole('searchbox',{name:'Search music',exact:true}).fill('Kendrick Lamar luther');await a.locator('.music-page-search button').click();await a.locator('.music-browse-track .song-card-details strong').filter({hasText:/^luther$/i}).first().waitFor();
 assert.equal(await a.getByRole('combobox',{name:'Send music to',exact:true}).inputValue(),cid);
 assert.equal(await a.locator('.music-page').getByText(/paste|preview/i).count(),0);
 await a.waitForFunction(()=>document.querySelector('[data-music-status]')?.textContent===''&&[...document.querySelectorAll('.music-browse-track .song-artwork')].slice(0,3).every(img=>img.complete&&img.naturalWidth>0));
 await a.screenshot({animations:'disabled',path:path.join(output,'music-browse-desktop.png')});
 console.log('Sending song');const responsePromise=a.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/conversations/'+encodeURIComponent(cid)+'/messages'));
 await a.locator('.music-browse-track').filter({has:a.locator('.song-card-details strong').filter({hasText:/^luther$/i})}).first().getByRole('button',{name:/^Send /}).click();const sent=await (await responsePromise).json();created.push(sent.message.id);
 console.log('Song sent',sent.message.id);await b.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));const card=b.locator('[data-message="'+sent.message.id+'"] .song-card');await card.waitFor();assert.equal(await card.locator('.voice-message').count(),0);await card.locator('[data-song-play]').click();await b.waitForFunction(id=>document.querySelector('[data-message="'+id+'"] .song-card audio')?.currentTime>0,sent.message.id);
 assert.equal(await card.locator('[data-song-play]').getAttribute('aria-pressed'),'true');assert.equal(await card.locator('[data-song-seek]').isEnabled(),true);
 await card.locator('[data-song-seek]').fill('500');assert.ok(await card.locator('audio').evaluate(audio=>audio.currentTime>=audio.duration*.45));
 const retained=await card.locator('audio').evaluate(audio=>{audio.dataset.qaRetained='yes';return audio.currentTime;});
 const followup=await liveAPI('/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id:crypto.randomUUID(),text:'Music card playback verification'});created.push(followup.message.id);await b.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await b.locator('[data-message="'+followup.message.id+'"]').waitFor();assert.equal(await card.locator('audio').getAttribute('data-qa-retained'),'yes');assert.ok(await card.locator('audio').evaluate(audio=>!audio.paused));
 await card.locator('[data-song-play]').click();assert.equal(await card.locator('audio').evaluate(audio=>audio.paused),true);
 pass('Real Apple search and artwork; direct Send; recipient playback, pause, seek and retained audio through incoming messages');
 await chat(a);assert.equal(await a.locator('#composer').evaluate(el=>el.value),'Draft stays while sharing a song');await a.locator('#composer').fill('');
 await a.locator('[data-message="'+sent.message.id+'"] .song-card').waitFor();await a.screenshot({animations:'disabled',path:path.join(output,'chat-desktop.png')});
 await a.locator('[data-action=music]').click();await a.getByRole('button',{name:'This week',exact:true}).click();await a.locator('.music-history-row').filter({hasText:'luther'}).first().waitFor();await a.screenshot({animations:'disabled',path:path.join(output,'music-week.png')});
 await a.locator('[data-music-view=friends]').click();await a.locator('[data-music-view=friends][aria-pressed=true]').waitFor();await a.locator('.music-history-row').filter({hasText:'Snooze'}).first().waitFor();
 pass('Music navigation preserves composer drafts; weekly history and opted-in friend history render from the selected Worker/D1');
 for(const width of [390,768]){await a.setViewportSize({width,height:844});await a.locator('[data-music-view=browse]').click();await a.locator('.music-browse-track').first().waitFor();assert.ok(await a.locator('.music-page').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await a.screenshot({animations:'disabled',path:path.join(output,'music-'+width+'.png')});await chat(a);assert.ok(await a.locator('#composer').isVisible());assert.ok(await a.locator('.composer').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await a.screenshot({animations:'disabled',path:path.join(output,'chat-'+width+'.png')});await a.locator('[data-action=music-share]').click();}
 await a.setViewportSize({width:1440,height:1000});await a.getByRole('button',{name:'Choose theme',exact:true}).click();await a.locator('[data-choose-theme=paper]').click();await a.getByRole('button',{name:'Use Paper',exact:true}).click();await a.screenshot({animations:'disabled',path:path.join(output,'music-light.png')});
 assert.deepEqual(errors,[]);pass('390/768/1440 layouts, light theme, no horizontal overflow or uncaught browser errors');
}catch(error){for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:path.join(output,'failure-'+i+'.png')}).catch(()=>{});console.error('PAGE',i,(await pages[i].locator('body').innerText()).slice(-2200));}throw error;}finally{
 for(const id of created)try{await liveAPI('/messages/'+id,'DELETE');}catch(error){console.error('QA cleanup failed:',id,error.message);}
 if(process.env.QA_REAL_HISTORY==='1'){
  for(let i=0;i<priorSharing.length;i++)await liveAPI('/listening-history','POST',{shared:priorSharing[i]},i);
  const safe=historyCreated.filter(row=>qa.users.some(u=>u.uid===row.uid)&&/^[a-f0-9-]{36}$/i.test(row.id)&&/^[A-Za-z0-9_-]+$/.test(row.uid));
  fs.writeFileSync(path.join(output,'qa-history-cleanup.sql'),safe.map(row=>"DELETE FROM listening_history WHERE uid='"+row.uid+"' AND id='"+row.id+"';").join('\n'));
 }
 for(const page of pages)await page.context().unrouteAll({behavior:'ignoreErrors'});
 await browser.close();
}
