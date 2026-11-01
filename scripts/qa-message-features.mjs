import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const site=process.env.QA_SITE||'http://127.0.0.1:5196/',output=path.resolve('output/playwright/message-features');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const pass=name=>console.log('PASS:',name);
const message=(id,text)=>({id,text,sender:'one',conversation:'chat',created:10000});
try{
 await context.route('**/feature-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>Message feature regression checks</title></head><body><main id="host"></main></body></html>'}));
 await page.goto(new URL('feature-fixture',site).href);
 await page.evaluate(async()=>{
  const {openMessageSearch}=await import('/src/message-search.js');
  window.requests=[];window.notices=[];
  const S=window.searchState={user:{uid:'one'},session:1,conversations:[]};
  window.showSearch=()=>openMessageSearch({S,api:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject})),modal:(name,html)=>{const panel=document.createElement('dialog');panel.innerHTML=html;document.body.append(panel);panel.addEventListener('close',()=>panel.remove());panel.showModal();return panel;},user:()=>({name:'Alex'}),title:()=> 'QA conversation',toast:text=>notices.push(text),jump:()=>{},openChat:()=>{},settings:()=>{}});
  showSearch();
 });
 const query=page.getByRole('searchbox',{name:'Search Vela'});
 await query.fill('fresh');
 await page.waitForFunction(()=>requests.length===2);
 assert.equal(await page.evaluate(()=>requests[0].options.signal.aborted),true);
 await page.evaluate(m=>requests[1].resolve({messages:[m],more:true}),message('fresh','Fresh result'));
 await page.getByText('Fresh result',{exact:true}).waitFor();
 await page.evaluate(()=>requests[0].reject(new Error('Old request failed')));
 assert.equal(await page.locator('[data-search-status]').innerText(),'1 result · More available');
 pass('Old responses and errors cannot replace a newer query; outdated requests are aborted');

 await page.evaluate(()=>{const more=document.querySelector('[data-more]');more.click();more.click();});
 assert.equal(await page.evaluate(()=>requests.length),3);
 await page.evaluate(m=>requests[2].resolve({messages:[m,{...m,id:'second',text:'Second result',created:9000}],more:true}),message('fresh','Fresh result'));
 await page.getByText('Second result',{exact:true}).waitFor();assert.equal(await page.locator('.connection-results button').count(),2);
 await page.locator('[data-more]').click();
 await page.evaluate(()=>requests[3].reject(new Error('Connection interrupted')));
 await page.locator('[data-retry]').waitFor();assert.equal(await page.locator('.connection-results button').count(),2);
 await page.locator('[data-retry]').click();
 assert.equal(await page.evaluate(()=>requests[3].url===requests[4].url),true);
 await page.evaluate(()=>requests[4].resolve({messages:[],more:false}));
 await page.locator('[data-search-status]').filter({hasText:'2 results'}).waitFor();
 pass('Pagination is serialized and deduplicated; a failed page retains results and retries its cursor');

 await query.fill('cancel debounce');await page.getByRole('button',{name:'People',exact:true}).click();
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>requests.length),5);
 assert.equal(await page.getByRole('button',{name:'People',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'All',exact:true}).click();
 await page.evaluate(()=>document.querySelector('dialog').close());
 await page.evaluate(()=>requests[5].reject(new Error('Closed request')));assert.deepEqual(errors,[]);
 pass('Changing filters cancels the input debounce; closing a pending search is safe');

 await page.evaluate(()=>showSearch());
 await page.evaluate(m=>{searchState.user={uid:'one',name:'Refreshed profile'};requests[6].resolve({messages:[m],more:false});},message('refresh','Profile refresh result'));
 await page.getByText('Profile refresh result',{exact:true}).waitFor();
 await page.getByRole('searchbox',{name:'Search Vela'}).fill('session change');
 await page.waitForFunction(()=>requests.length===8);
 await page.evaluate(m=>{searchState.session++;requests[7].resolve({messages:[m],more:false});},message('old-session','Old session result'));
 assert.equal(await page.getByText('Old session result',{exact:true}).count(),0);
 await page.evaluate(()=>document.querySelector('dialog').close());
 pass('Profile refresh preserves search; a new authentication session rejects old results');

 await page.evaluate(async()=>{
  const {createConnections}=await import('/src/connections.js');
  window.jumpRequests=[];window.jumpState={user:{uid:'one'},session:1,active:'start',view:'chat',messages:[]};window.jumpOpened=[];window.jumpRendered=0;window.hydration=[];window.delayHydration=false;
  window.navigation=createConnections({S:jumpState,getEngine:()=>null,api:url=>new Promise(resolve=>jumpRequests.push({url,resolve})),openChat:async cid=>{jumpOpened.push(cid);jumpState.active=cid;jumpState.view='chat';},hydrateFiles:async()=>{if(delayHydration)await new Promise(resolve=>hydration.push(resolve));},renderMessages:()=>jumpRendered++,invalidateMessageRequests:()=>{},toast:()=>{}});
  window.jumpTask=navigation.jump('old');jumpState.active='manually-selected';
  jumpRequests[0].resolve({conversation:'old-chat',messages:[]});await jumpTask;
 });
 assert.deepEqual(await page.evaluate(()=>jumpOpened),[]);
 await page.evaluate(async()=>{
  jumpState.active='start';window.firstJump=navigation.jump('first');window.secondJump=navigation.jump('second');
  jumpRequests[2].resolve({conversation:'second-chat',messages:[]});await secondJump;
  jumpRequests[1].resolve({conversation:'first-chat',messages:[]});await firstJump;
 });
 assert.deepEqual(await page.evaluate(()=>jumpOpened),['second-chat']);assert.equal(await page.evaluate(()=>jumpRendered),1);
 await page.evaluate(async()=>{
  delayHydration=true;window.hydrationJump=navigation.jump('hydrating');jumpRequests[3].resolve({conversation:'hydrating-chat',messages:[]});
 });
 await page.waitForFunction(()=>hydration.length===1);
 await page.evaluate(async()=>{jumpState.active='new-chat';hydration[0]();await hydrationJump;});
 assert.equal(await page.evaluate(()=>jumpRendered),1);
 pass('Message navigation ignores delayed responses after manual navigation, a newer jump, or a conversation change during media hydration');

 await page.evaluate(async()=>{
  const {renderSavedMessages}=await import('/src/saved-messages.js');
  window.savedCalls=0;window.opened=[];window.removeFails=true;window.openFails=true;
  window.savedData=[{id:'report',conversation:'chat',sender:'one',text:'Quarterly plan',created:10000,attachment:{kind:'files',files:[{name:'Budget-October.pdf'},{name:'Notes.txt'}]}},{id:'photo',conversation:'chat',sender:'two',text:'Trip',created:9000}];
  await renderSavedMessages(document.querySelector('#host'),{api:async(url,options)=>{if(options){if(removeFails)throw Error('Remove failed');return {ok:true};}if(++savedCalls===1)throw Error('Offline');return {messages:savedData};},user:id=>({name:id==='one'?'Alex':'Sam'}),conversationTitle:()=> 'Project room',openMessage:async id=>{if(openFails)throw Error('Message unavailable');opened.push(id);},toast:text=>notices.push(text)});
 });
 const savedQuery=page.getByRole('searchbox',{name:'Search saved messages'});
 await savedQuery.fill('budget alex');await page.getByRole('button',{name:'Retry',exact:true}).click();
 await page.locator('.saved-message-count').filter({hasText:'1 of 2'}).waitFor();assert.equal(await savedQuery.inputValue(),'budget alex');
 assert.equal(await page.locator('.saved-message-row').count(),1);
 const savedOpen=page.locator('[data-saved-open=report]');
 await savedOpen.click();await page.waitForFunction(()=>notices.includes('Message unavailable'));assert.equal(await savedOpen.isEnabled(),true);
 await page.evaluate(()=>openFails=false);await savedOpen.click();assert.deepEqual(await page.evaluate(()=>opened),['report']);
 pass('Saved-message search matches filenames plus people; retry preserves the query; opening passes the exact message ID and recovers from errors');
 await page.locator('[data-saved-remove=report]').click();await page.waitForFunction(()=>notices.includes('Remove failed'));assert.equal(await page.locator('[data-saved-remove=report]').isEnabled(),true);
 await page.evaluate(()=>removeFails=false);await page.locator('[data-saved-remove=report]').click();await page.locator('.saved-message-count').filter({hasText:'0 of 1'}).waitFor();
 await savedQuery.fill('');assert.equal(await page.locator('.saved-message-row').count(),1);
 pass('Bookmark removal preserves data on failure and updates search counts on success');

 if(process.env.QA_LIVE==='1'){
  const qa=JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS||'.private/qa.json','utf8')),backend='https://vela-cyd.cydpixl7.workers.dev',cid=qa.users.slice(0,2).map(u=>u.uid).sort().join(':'),id=crypto.randomUUID(),text='Saved navigation verification '+id;
  let token,created=false;
  await context.addInitScript(()=>{localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1');});
  await context.route(backend+'/**',async route=>{const response=await route.fetch({headers:{...route.request().headers(),origin:'https://cydpixl.github.io'}});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':new URL(site).origin}});});
  await context.route('http://127.0.0.1:5000/**',route=>route.fulfill({json:{current_session_id:null,sessions:[]},headers:{'access-control-allow-origin':'*'}}));
  page.on('request',r=>{if(r.url().startsWith(backend+'/api/')&&r.headers().authorization)token=r.headers().authorization;});
  async function api(url,method='GET',body){const response=await fetch(backend+'/api'+url,{method,headers:{Authorization:token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.ok(response.ok,data.error||response.status);return data;}
  try{
   await page.goto(site);await page.locator('[name=handle]').fill(qa.users[0].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.getByRole('button',{name:'Tools & uploads',exact:true}).waitFor();
   await api('/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id,text});created=true;await api('/messages/'+id,'PATCH',{bookmark:true});
   await page.locator('[data-action=bookmarks]').click();await page.locator('[data-saved-open="'+id+'"]').waitFor();
   await page.screenshot({path:path.join(output,'saved-messages.png')});
   await page.locator('[data-saved-open="'+id+'"]').click();await page.locator('[data-message="'+id+'"].message-flash').waitFor();
   assert.equal(await page.locator('[data-message="'+id+'"]').evaluate(el=>document.activeElement===el),true);
   await page.screenshot({path:path.join(output,'saved-message-located.png')});
   await page.locator('[data-action=quick-search]').click();await page.getByRole('searchbox',{name:'Search Vela',exact:true}).fill(id);
   await page.locator('.connection-results button').filter({hasText:text}).waitFor();await page.screenshot({path:path.join(output,'search.png')});
   await page.locator('.connection-results button').filter({hasText:text}).click();await page.locator('[data-message="'+id+'"].message-flash').waitFor();
   pass('Live QA account: save → Saved Messages → exact focused message; authenticated search → same message');
  }finally{if(created){await api('/messages/'+id,'PATCH',{bookmark:false});await api('/messages/'+id,'DELETE');}}
 }
 assert.deepEqual(errors,[]);pass('No uncaught browser JavaScript errors');
}finally{await browser.close();}
