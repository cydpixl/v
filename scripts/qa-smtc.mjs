import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const script=fs.readFileSync('public/vela-smtc.js','utf8');
try{
 const page=await browser.newPage();let mode='playing',requests=0;
 const session=(title,source,status=4)=>({source_app_id:source,media_properties:{Title:title,Artist:'QA Artist'},playback_info:{PlaybackStatus:status},timeline_properties:{StartTime:0,EndTime:180000,Position:12000}});
 await page.route('http://127.0.0.1:5000/**',async route=>{requests++;if(mode==='offline')return route.abort();await route.fulfill({json:{current_session_id:'spotify',sessions:[session('Old Apple song','AppleInc.AppleMusicWin_nzyj5cx40ttqa!App',5),session('Current track','spotify',mode==='paused'?5:4)]},headers:{'access-control-allow-origin':'*'}});});
 await page.route('**/bridge-harness',route=>route.fulfill({contentType:'text/html',body:'<div class="app-shell"><aside class="sidebar"><div id="account-dock"><div class="self-profile"><small>bridge-test</small></div></div></aside></div>'}));
 await page.goto('http://127.0.0.1:5208/bridge-harness');
 await page.evaluate(()=>localStorage.setItem('vela.smtc.v1.bridge-test',JSON.stringify({enabled:false,source:'apple'})));
 await page.addScriptTag({content:script});await page.locator('[data-smtc-title]').filter({hasText:'Current track'}).waitFor();assert.ok(requests>0);
 await page.locator('[data-smtc-settings]').click();assert.equal(await page.locator('[data-smtc-source]').inputValue(),'any');assert.equal(await page.locator('[data-smtc-share]').isChecked(),false);
 assert.equal(await page.locator('.vela-smtc-settings-body input:not([type=checkbox])').count(),0);
 mode='offline';await page.locator('[data-smtc-connect]').click();await page.getByText('Waiting for SMTC Bridge',{exact:true}).first().waitFor();
 mode='playing';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>!document.querySelector('.vela-smtc-song').hidden);
 mode='paused';await page.locator('[data-smtc-connect]').click();await page.getByText('Playback is paused.',{exact:true}).waitFor();await page.locator('[data-smtc-paused]').check();assert.equal(await page.locator('.vela-smtc-song').isVisible(),true);
 await page.locator('[data-smtc-disconnect]').click();await page.reload();await page.addScriptTag({content:script});assert.equal(await page.locator('[data-smtc-status]').textContent(),'Automatic detection off');
 console.log('PASS bridge: auto-connect, old-settings migration, active player, offline recovery, pause, no entry fields, private sharing, persisted opt-out');
 if(process.env.QA_NATIVE_BRIDGE){
  const native=await browser.newPage();native.on('console',m=>console.log('NATIVE',m.text()));native.on('requestfailed',r=>console.log('NATIVE FAILED',r.url(),r.failure()));await native.route('**/native-bridge-harness',route=>route.fulfill({contentType:'text/html',body:'<div class="app-shell"><aside class="sidebar"><div id="account-dock"><div class="self-profile"><small>native-bridge-test</small></div></div></aside></div>'}));
  await native.context().grantPermissions(['local-network-access']);
  await native.goto('http://127.0.0.1:5208/native-bridge-harness');await native.addScriptTag({content:script});await native.waitForFunction(()=>document.querySelector('[data-smtc-status]')?.textContent==='Listening now'||document.querySelector('[data-smtc-status]')?.textContent==='Paused'||document.querySelector('[data-smtc-status]')?.textContent==='No active music');
  console.log('PASS native installed SMTC Bridge automatically reached from Chrome:',await native.locator('[data-smtc-status]').textContent());
 }
}finally{await browser.close();}
