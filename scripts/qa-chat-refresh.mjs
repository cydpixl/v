import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync('C:/Users/jayme/Downloads/Vela-controls-repair/.private/qa.json'));
const key=fs.readFileSync('src/auth.js','utf8').match(/apiKey:'([^']+)'/)[1],person=qa.users[0];
const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:person.handle+'@users.connections.invalid',password:qa.password,returnSecureToken:true})}).then(r=>r.json());
assert.ok(login.localId,'QA sign-in failed');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:940},serviceWorkers:'block'});
 await context.addInitScript(uid=>{localStorage.setItem('desktop.device.setup.v3','{"ready":true}');localStorage.setItem('desktop.setup.complete.'+uid,'1');localStorage.setItem('vela.auto-fullscreen','off')},login.localId);
 const page=await context.newPage(),errors=[],sockets=[];let requests=0,total=160;
 await page.routeWebSocket('**/api/live*',socket=>{sockets.push(socket);socket.onMessage(message=>{if(message==='ping')socket.send('pong')})});
 page.on('pageerror',error=>errors.push(error.message));
 const base=Date.now()-86400000;
 await page.route('**/api/conversations/*/messages*',route=>{
  if(route.request().method()!=='GET')throw Error('Test must not send messages.');
  const url=new URL(route.request().url()),cid=url.pathname.split('/')[3],older=url.searchParams.has('before');requests++;
  const messages=Array.from({length:older?80:80},(_,i)=>{const index=older?i:total-80+i;return {id:'refresh-fixture-'+String(index).padStart(4,'0'),conversation:cid,sender:login.localId,text:'Chat refresh fixture '+index,created:base+index*1000,reactions:[]}});
  return route.fulfill({json:{messages,more:!older}});
 });
 await page.goto(process.env.QA_SITE||'http://127.0.0.1:5194');await page.locator('[name=handle]').fill(person.handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.locator('#composer').waitFor({state:'attached',timeout:45000});await page.waitForFunction(()=>document.body.classList.contains('chat-app-hidden'));
 await page.locator('.desktop-apps').getByRole('button',{name:'Open Messages',exact:true}).click();
 await page.locator('#load-older').click();
 await page.waitForTimeout(350);
 await page.evaluate(()=>{const s=document.querySelector('#message-scroll');s.scrollTop=s.scrollHeight});
 await page.waitForTimeout(250);
 const before=requests;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(500);assert.ok(requests>before);
 const ordered=await page.evaluate(()=>window.__pixl?window.__pixl.state.messages.map(m=>m.created):[...document.querySelectorAll('#messages [data-message]')].map(row=>Number(row.dataset.message.split('-').at(-1))));assert.deepEqual(ordered,[...ordered].sort((a,b)=>a-b),'Refreshing after loading history must keep oldest-to-newest order');
 await page.locator('[data-message="refresh-fixture-0159"]').waitFor();
 for(let i=0;i<3;i++){
  total++;await page.getByRole('button',{name:'Show desktop',exact:true}).click();
  await page.locator('.desktop-apps').getByRole('button',{name:'Open Messages',exact:true}).click();
  await page.locator('[data-message="refresh-fixture-'+String(total-1).padStart(4,'0')+'"]').waitFor();
 }
 assert.ok(sockets.length,'Live connection was not opened');total++;sockets.at(-1).close({code:1012,reason:'QA reconnect'});
 await page.locator('[data-message="refresh-fixture-'+String(total-1).padStart(4,'0')+'"]').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS paginated history stays ordered through refresh, reopening Messages and reconnecting fetch missed messages without sending.');
}finally{await browser.close()}
