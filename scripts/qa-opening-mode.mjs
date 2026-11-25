import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium, devices, webkit} from 'playwright';

const site = new URL((process.env.QA_SITE || 'http://127.0.0.1:5194').replace(/\/?$/, '/')).href;
const screenshots = process.env.QA_OPENING_SCREENSHOTS;
const me = {uid: 'qa-opening-self', name: 'Taylor', handle: 'taylor', status: 'dnd'};
const friend = {uid: 'qa-opening-friend', name: 'Morgan', handle: 'morgan', status: 'online'};
const now = Date.now();
const member = user => ({...user, last_read: 0});
const conversations = [
  {id: 'direct', kind: 'direct', members: [member(me), member(friend)], updated: now, unread: 1, preview: 'Can you send the photo?'},
  {id: 'group', kind: 'group', name: 'Weekend Plans', members: [member(me), member(friend)], updated: now - 1, unread: 0, preview: 'Meet at noon'}
];
const initial = {id:'first', conversation:'direct', sender:friend.uid, created:now - 1000, text:conversations[0].preview};
const email = 'taylor@users.connections.invalid';
const claims = {sub:me.uid, user_id:me.uid, iat:Math.floor(now/1000), exp:Math.floor(now/1000)+3600};
const token = 'e30.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.fixture';
const browser = await chromium.launch({channel:'chrome', headless:true});
const mobileBrowser = process.env.QA_MOBILE_WEBKIT ? await webkit.launch() : browser;
const errors = [];

async function fixture(options = {}, engine = browser) {
  const context = await engine.newContext({serviceWorkers:'block', ...options});
  const messages = {direct:[initial],group:[{...initial,id:'group-first',conversation:'group',text:'Meet at noon'}]};
  const posted = [];
  const read = [];
  const failOnce = new Set(['Retry send test']);
  let connectSocket;
  const socketReady = new Promise(resolve => { connectSocket = resolve; });
  await context.route('https://identitytoolkit.googleapis.com/**', route => {
    const url = route.request().url();
    return route.fulfill({
      headers:{'access-control-allow-origin':'*'},
      json:url.includes('accounts:lookup') ? {users:[{localId:me.uid,email}]} :
        {localId:me.uid,email,idToken:token,refreshToken:'fixture',expiresIn:'3600'}
    });
  });
  await context.route('**/api/**', async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': new URL(site).origin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
    if (request.method() === 'OPTIONS') return route.fulfill({status:204,headers});
    const path = new URL(request.url()).pathname;
    const cid = path.split('/')[3];
    let data = {};
    if (path === '/api/me') data = {user:me};
    if (path === '/api/state') data = {user:me,friends:[{...friend,status:'accepted'}],conversations};
    if (path === '/api/preferences') data = {preferences:{},conversations:{}};
    if (path === '/api/music-library') data = {items:[]};
    if (path === '/api/ticket') data = {ticket:'fixture'};
    if (path.endsWith('/read')) read.push(cid);
    if (path.endsWith('/messages') && messages[cid]) {
      if (request.method() === 'POST') {
        assert.equal(request.headers().authorization, 'Bearer '+token);
        const body = request.postDataJSON();
        if (failOnce.delete(body.text)) return route.fulfill({status:503,headers,json:{error:'Temporary outage'}});
        const message = {...body, conversation:cid, sender:me.uid, created:Date.now()};
        messages[cid].push(message);
        posted.push(message);
        data = {message};
      } else data = {messages:messages[cid],more:false};
    }
    await route.fulfill({headers,json:data});
  });
  await context.routeWebSocket('**/api/live?*', ws => {
    connectSocket(ws);
    ws.onMessage(message => { if(message==='ping')ws.send('pong'); });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(14000);
  page.on('pageerror', error => errors.push(error.message));
  return {context,page,posted,read,messages,socketReady};
}

async function signIn(page) {
  await page.locator('[name=handle]').fill('taylor');
  await page.locator('[name=password]').fill('fixture-password');
  await page.getByRole('button',{name:'Log In',exact:true}).click();
}

async function shot(page, name) {
  if(screenshots) await page.screenshot({path:screenshots+'/'+name+'.png'});
}

async function verifyPlacement(page) {
  const bounds = await page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect();
    const pane = box('.workspace');
    const incoming = box('.message.incoming .message-text');
    const outgoing = box('.message.mine .message-text');
    const composer = box('#composer-form .composer');
    return {
      left: incoming.left - pane.left,
      right: pane.right - outgoing.right,
      composerLeft: Math.abs(incoming.left - composer.left),
      composerRight: Math.abs(outgoing.right - composer.right)
    };
  });
  assert.ok(bounds.left >= 8 && bounds.left <= 32, JSON.stringify(bounds));
  assert.ok(bounds.right >= 8 && bounds.right <= 32, JSON.stringify(bounds));
  assert.ok(bounds.composerLeft <= 2 && bounds.composerRight <= 2, JSON.stringify(bounds));
}

try {
  if(screenshots)await mkdir(screenshots,{recursive:true});
  const manifest = await fetch(new URL('manifest.webmanifest',site)).then(response=>response.json());
  assert.equal(manifest.display,'standalone');

  const mobile = await fixture(devices['iPhone 13'], mobileBrowser);
  const {page} = mobile;
  await page.goto(site);
  const chooser = page.getByRole('dialog',{name:'How do you want to open VELA?'});
  await chooser.waitFor();
  assert.equal(await chooser.getByRole('button',{name:'Continue'}).isEnabled(),false);
  await shot(page,'opening-mode-mobile');
  await chooser.getByRole('radio',{name:/Simple Chat/}).check();
  await chooser.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('heading',{name:'Sign in to VELA'}).waitFor();
  assert.equal(await page.locator('.win-first-setup').count(),0);
  await signIn(page);
  const group = page.getByRole('button',{name:'Open Weekend Plans'});
  const direct = page.getByRole('button',{name:'Open Morgan'});
  await group.waitFor();
  await direct.waitFor();
  assert.equal(await direct.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
  assert.equal(await page.locator('#vela-desktop').count(),0);
  assert.deepEqual(mobile.read,[]);
  await shot(page,'simple-chat-list-mobile');

  await group.click();
  await page.locator('#messages').getByText('Meet at noon').waitFor();
  await page.locator('#composer').fill('Saved group draft');
  await page.getByRole('button',{name:'Back to messages'}).click();
  await direct.click();
  await page.locator('#messages').getByText(initial.text).waitFor();
  await page.locator('#composer').fill('Retry send test');
  await page.getByRole('button',{name:'Send Message',exact:true}).click();
  const sent = page.locator('#messages .mine').filter({hasText:'Retry send test'});
  await sent.getByText('Sent',{exact:true}).waitFor();
  assert.equal(mobile.posted.length,1);
  assert.equal(mobile.posted[0].conversation,'direct');
  assert.ok(mobile.read.includes('direct'));
  const live = await Promise.race([mobile.socketReady,delay(14000,null,{ref:false})]);
  assert.ok(live,'The live message socket connected');
  const reply = {...initial,id:'live-reply',created:Date.now()+1,text:'Got it, thanks!'};
  mobile.messages.direct.push(reply);
  live.send(JSON.stringify({type:'message',conversation:'direct',sender:friend.uid,message:reply}));
  await page.locator('#messages').getByText(reply.text).waitFor();
  assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  await verifyPlacement(page);
  await shot(page,'simple-chat-thread-mobile');

  await page.getByRole('button',{name:'Back to messages'}).click();
  await group.click();
  await page.waitForFunction(()=>document.querySelector('#composer')?.value==='Saved group draft');
  await page.reload();
  await group.waitFor();
  assert.equal(await chooser.count(),0);
  await group.click();
  await page.waitForFunction(()=>document.querySelector('#composer')?.value==='Saved group draft');

  const desktop = await fixture({viewport:{width:1920,height:908}});
  desktop.messages.direct.push({...initial,id:'wide-outgoing',sender:me.uid,text:'I’ll send it now.'});
  const wide = desktop.page;
  await wide.addInitScript(uid=>{
    localStorage.setItem('desktop.device.setup.v3','{"ready":true}');
    localStorage.setItem('desktop.setup.complete.'+uid,'1');
  },me.uid);
  await wide.goto(site);
  await wide.getByRole('radio',{name:/Desktop/}).check();
  await wide.getByRole('switch',{name:/Automatic fullscreen/}).uncheck();
  await wide.getByRole('button',{name:'Continue'}).click();
  await signIn(wide);
  await wide.locator('#vela-desktop').waitFor();
  const desktopSettings = wide.getByRole('button',{name:'Open Settings',exact:true});
  await desktopSettings.click();
  await wide.getByRole('button',{name:'Opening preferences',exact:true}).click();
  assert.equal(await wide.getByRole('switch',{name:/Automatic fullscreen/}).isChecked(),false);
  assert.equal(await wide.evaluate(()=>document.fullscreenElement),null);
  await wide.getByRole('switch',{name:/Automatic fullscreen/}).check();
  await wide.getByRole('button',{name:'Save preferences'}).click();
  await wide.getByText('Preferences saved.',{exact:true}).waitFor();
  await wide.getByRole('button',{name:'Close Settings'}).click();
  await wide.waitForFunction(()=>document.fullscreenElement===document.documentElement);
  await wide.evaluate(()=>document.exitFullscreen());
  await desktopSettings.click();
  await wide.getByRole('button',{name:'Opening preferences',exact:true}).click();
  assert.equal(await wide.evaluate(()=>document.fullscreenElement),null);
  await wide.getByRole('radio',{name:/Simple Chat/}).check();
  await wide.getByRole('button',{name:'Save preferences'}).click();
  const wideDirect = wide.getByRole('button',{name:'Open Morgan'});
  await wideDirect.click();
  await wide.locator('#messages').getByText(initial.text).waitFor();
  await verifyPlacement(wide);
  assert.equal(await wide.getByRole('button',{name:'Open Weekend Plans'}).isVisible(),true);
  assert.equal(await wide.locator('#vela-desktop').count(),0);
  assert.equal(await wide.evaluate(()=>document.fullscreenElement),null);
  await shot(wide,'simple-chat-desktop');

  await wide.getByRole('button',{name:'Opening preferences',exact:true}).click();
  await wide.getByRole('radio',{name:/Desktop/}).check();
  await wide.getByRole('switch',{name:/Automatic fullscreen/}).uncheck();
  await wide.getByRole('button',{name:'Save preferences'}).click();
  await wide.locator('#vela-desktop').waitFor();
  assert.equal(await wide.evaluate(()=>document.fullscreenElement),null);
  assert.deepEqual(errors,[]);
  assert.equal(await wide.locator('dialog.opening-dialog').count(),0);
  console.log('PASS first-open choices, fullscreen on/off, Desktop restoration, phone and wide alignment, shared send/retry and live message flow, draft persistence, and standalone manifest.');
} finally {
  if(mobileBrowser!==browser)await mobileBrowser.close();
  await browser.close();
}
