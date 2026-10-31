import {chromium} from 'playwright';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {normalizeRewriteConfig} from '../src/rewrite-rules.mjs';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8')),browser=await chromium.launch({channel:'chrome',headless:true});
let admin=true,quota=false,config={enabled:false,rules:[],revision:0};const original={id:'fixture-other-message',conversation:'fixture-room',sender:'member',text:'Original member message',created:Date.now()-1000,deleted:0,reactions:[],pinned:0};const messages=[{...original}],errors=[];
const owner=()=>({uid:'owner',handle:'pixl',name:'Site Admin',status:'online',last_seen:Date.now(),site_admin:admin});
const member={uid:'member',handle:'member',name:'Other Member',status:'online',last_seen:Date.now(),last_read:0};
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000},timezoneId:'America/New_York'});
await context.addInitScript(()=>{localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1');});
await context.route('https://cydpixl.github.io/v/**',route=>route.fulfill({path:path.resolve('dist-gh',new URL(route.request().url()).pathname.slice(3)||'index.html')}));
await context.route('http://127.0.0.1:5000/**',route=>route.fulfill({json:{sessions:[]},headers:{'access-control-allow-origin':'*'}}));
await context.routeWebSocket('wss://vela-cyd.cydpixl7.workers.dev/**',socket=>{socket.onMessage(value=>{if(value==='ping')socket.send('pong');});});
await context.route('https://vela-cyd.cydpixl7.workers.dev/api/**',async route=>{
 const request=route.request(),url=new URL(request.url()),p=url.pathname.slice(4),method=request.method(),headers={'access-control-allow-origin':'https://cydpixl.github.io','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'Authorization,Content-Type'};
 if(method==='OPTIONS')return route.fulfill({status:204,headers});
 let result={ok:true},status=200,body={};try{body=request.postDataJSON()||{};}catch{}
 if(p==='/me'){if(quota){status=503;result={error:'Database allowance reached',code:'DATABASE_QUOTA_EXCEEDED',resetAt:Date.parse('2026-11-01T00:00:00Z')};}else result={user:owner()};}
 else if(p==='/state')result={user:owner(),friends:[],blocks:[],conversations:[{id:'fixture-room',kind:'direct',name:'Other Member',members:[owner(),member],unread:0,preview:messages.at(-1).text,call:null}]};
 else if(p==='/preferences')result={preferences:{},conversations:{},hidden:[]};
 else if(p==='/ticket')result={ticket:'fixture'};
 else if(p==='/live-music-shares'||p.endsWith('/live-music'))result={messages:[]};
 else if(p.startsWith('/profile-extras/'))result={profile:{}};
 else if(p.startsWith('/profiles/'))result={profile:{...owner(),bio:'',pronouns:'',banner:'#232428',collection:[],mutualFriends:[],mutualServers:[]}};
 else if(p==='/admin/rewrite-rules'){if(!admin){status=403;result={error:'Administrator access required'};}else if(method==='PUT'){config={...normalizeRewriteConfig(body),revision:config.revision+1};result=config;}else result=config;}
 else if(p==='/conversations/fixture-room/messages'){if(method==='GET')result={messages,more:false};else{const m={...original,id:body.id,sender:'owner',text:body.text,created:Date.now()};messages.push(m);result={id:m.id,message:m};}}
 else if(p.startsWith('/messages/')&&method==='PATCH'){const message=messages.find(m=>m.id===p.slice(10));if('text'in body){if(!admin&&message.sender!=='owner'){status=403;result={error:'Not allowed'};}else{message.text=body.text;message.edited=Date.now();}}}
 await route.fulfill({status,json:result,headers});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);fs.mkdirSync('output/playwright',{recursive:true});
async function openChat(){await page.locator('.app-shell').waitFor();await page.locator('.dm-row').first().click();await page.locator('#composer').waitFor();}
try{
 await page.goto('https://cydpixl.github.io/v/');await page.locator('[name=handle]').fill(qa.users[0].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await openChat();
 await page.getByRole('button',{name:'Slash commands',exact:true}).click();await page.getByRole('menuitem',{name:/\/rewrites/}).click();const dialog=page.getByRole('dialog',{name:'Custom message replacements'});await dialog.waitFor();
 await dialog.getByRole('button',{name:'Add replacement rule',exact:true}).click();await dialog.getByLabel('When someone says').fill('hello');await dialog.getByLabel('Replace with').fill('My own letter, exactly.');await dialog.locator('[data-rules-enabled]').check();await dialog.locator('[data-rule-test]').fill('HELLO there');await page.waitForFunction(()=>document.querySelector('[data-rule-result]').textContent==='My own letter, exactly.');
 await page.screenshot({path:'output/playwright/custom-rewrite-editor.png'});await dialog.getByRole('button',{name:'Save rules',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(config.enabled,true);assert.equal(config.rules[0].replacement,'My own letter, exactly.');
 await page.locator('[data-message="fixture-other-message"]').hover();await page.locator('[data-message="fixture-other-message"] [aria-label="More Message Actions"]').click();await page.getByRole('menuitem',{name:'Edit Message (Admin)',exact:true}).click();await page.getByRole('textbox',{name:'Edit message',exact:true}).fill('Corrected by the site administrator.');await page.getByRole('textbox',{name:'Edit message',exact:true}).press('Enter');await page.locator('.message-text').filter({hasText:'Corrected by the site administrator.'}).waitFor();assert.equal(messages[0].sender,'member');
 await page.getByRole('button',{name:'Slash commands',exact:true}).click();await page.getByRole('menuitem',{name:/\/rewrites/}).click();await dialog.locator('[data-rules-enabled]').uncheck();await dialog.getByRole('button',{name:'Save rules',exact:true}).click();assert.equal(config.enabled,false);
 await page.locator('#composer').fill('loog outttt and stupid');await page.getByRole('button',{name:'Send Message',exact:true}).click();await page.locator('.message-text').filter({hasText:'loog outttt and stupid'}).waitFor();assert.equal(messages.at(-1).text,'loog outttt and stupid');
 admin=false;await page.reload();await openChat();await page.getByRole('button',{name:'Slash commands',exact:true}).click();assert.equal(await page.getByRole('menuitem',{name:/\/rewrites/}).count(),0);await page.keyboard.press('Escape');assert.equal(await page.locator('[data-message="fixture-other-message"] [aria-label="Edit Message"]').count(),0);
 quota=true;await page.reload();await page.getByRole('heading',{name:'Connection interrupted'}).waitFor();assert.match(await page.locator('.auth-card').innerText(),/daily database allowance/);assert.match(await page.locator('.auth-card').innerText(),/8:00/);
 assert.deepEqual(errors,[]);console.log('PASS browser fixture: slash button, admin rule editor/save/disable/preview, other-author edit preserving sender, unrestricted text, member restrictions, clear quota reset time');
}catch(error){await page.screenshot({path:'output/playwright/message-admin-failure.png'}).catch(()=>{});throw error;}finally{await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
