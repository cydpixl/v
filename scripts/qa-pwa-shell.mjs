import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const site=process.env.QA_SITE||'http://127.0.0.1:5199/v/';
const browser=await chromium.launch({channel:'chrome',headless:true});
let offline=false;
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
if(site.includes('127.0.0.1'))await context.route('https://vela-cyd.cydpixl7.workers.dev/**',async route=>{try{if(offline){await route.abort();return;}const response=await route.fetch({headers:{...route.request().headers(),origin:'https://cydpixl.github.io'}});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':new URL(site).origin}});}catch{await route.abort().catch(()=>{});}});
const page=await context.newPage(),errors=[],network=[];page.on('requestfailed',r=>network.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));page.on('console',m=>{if(m.type()==='error')network.push({console:m.text().slice(0,300)})});page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(30000);
await context.addInitScript(()=>{localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1')});
try{
 await page.goto(site);await page.locator('[name=handle]').waitFor();await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const manifest=await page.evaluate(async()=>{const link=document.querySelector('link[rel=manifest]');return await(await fetch(link.href)).json();});
 for(const icon of manifest.icons){const response=await context.request.get(new URL(icon.src,site).href);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'image/png');}
 assert.ok(manifest.icons.some(x=>x.purpose==='maskable'&&x.sizes==='512x512'));
 const cache=await page.evaluate(async()=>{const name=(await caches.keys()).find(x=>x.startsWith('vela-shell-'));const keys=await(await caches.open(name)).keys();return {name,urls:keys.map(x=>x.url)};});
 assert.ok(cache.urls.some(x=>/assets\/index-.+\.js$/.test(x)));assert.ok(cache.urls.some(x=>/firebase-.+\.js$/.test(x)));assert.ok(cache.urls.some(x=>x.endsWith('/vela-smtc.js')));assert.equal(cache.urls.some(x=>x.includes('/api/')),false);
 console.log('PASS installable PNG/maskable icons and complete precached app graph',cache.urls.length);
 offline=true;await context.setOffline(true);await page.goto(new URL('?offline-reopen=1',site).href);await page.locator('[name=handle]').waitFor();assert.equal(await page.locator('.boot').count(),0);await page.screenshot({path:'output/playwright/pwa-offline.png'});
 console.log('PASS first offline reopen boots cached HTML, JavaScript, CSS, Firebase and social widget');
 offline=false;await context.setOffline(false);
 if(site.includes('127.0.0.1')){
  await page.locator('[name=handle]').fill('Update preserves this input');
  await page.evaluate(async()=>{await caches.open('unrelated-app-keep');await caches.open('vela-shell-obsolete-test');const registration=await navigator.serviceWorker.register(new URL('sw.js?qa-update=1',document.baseURI),{updateViaCache:'none'});await registration.update();});
  await page.locator('.pwa-update').waitFor();assert.equal(await page.locator('[name=handle]').inputValue(),'Update preserves this input');
  await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('unrelated-app-keep')&&!keys.includes('vela-shell-obsolete-test');});await page.locator('.pwa-update').getByRole('button',{name:'Dismiss update',exact:true}).click();
  console.log('PASS update notice preserves current form; activation clears only Vela caches');
 }
 const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8'));
 await page.locator('[name=handle]').fill(qa.users[0].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.locator('.sidebar-tools').waitFor({state:'attached'});
 const cid=[qa.users[0].uid,qa.users[1].uid].sort().join(':');await page.getByRole('button',{name:'Show Navigation',exact:true}).click();await page.locator('.dm-row[data-open="'+cid+'"]').click();await page.locator('#composer').fill('Offline reopen preserves this draft');
 offline=true;await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'You’re offline',exact:true}).waitFor();
 offline=false;await context.setOffline(false);await page.locator('.sidebar-tools').waitFor({state:'attached'});await page.getByRole('button',{name:'Show Navigation',exact:true}).click();await page.locator('.dm-row[data-open="'+cid+'"]').click();assert.equal(await page.locator('#composer').innerText(),'Offline reopen preserves this draft');
 console.log('PASS signed-in offline reopen shows recovery; reconnect restores session and draft');
 assert.deepEqual(errors,[]);fs.writeFileSync('output/playwright/pwa-shell-report.json',JSON.stringify({ok:true,cache,errors},null,2));
}catch(error){await page.screenshot({path:'output/playwright/pwa-shell-failure.png'});console.log('SHELL',await page.locator('body').innerText(),'ERRORS',errors);console.log('LOGS',await page.evaluate(()=>({scripts:[...document.scripts].map(s=>s.src),controller:navigator.serviceWorker.controller?.scriptURL,height:document.documentElement.style.getPropertyValue('--vela-app-height'),state:document.readyState})));console.log('NETWORK',network);throw error;}finally{await context.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});await browser.close();}
