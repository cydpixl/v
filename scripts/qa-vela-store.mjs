import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out=process.env.GAMES_QA_OUT||'output/playwright/vela-games';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
const base='http://127.0.0.1:5218/scripts/fixtures/vela-games.html';
const shot=async name=>{await p.waitForTimeout(450);await p.screenshot({path:out+'/'+name+'.png'});};
try{
 await p.goto(base);await p.waitForFunction(()=>!!window.qaHub);await p.evaluate(()=>window.qaHub.open('store'));await p.locator('.ms-store').waitFor();await shot('store-home-final');
 await p.getByRole('button',{name:'Next featured game'}).click();assert.equal(await p.locator('.ms-hero h1').innerText(),'Reaction Race');await p.getByRole('button',{name:'Previous featured game'}).click();assert.equal(await p.locator('.ms-hero h1').innerText(),'Bricks vs Balls');
 await p.getByRole('searchbox',{name:'Search apps and games'}).fill('stop at');assert.equal(await p.locator('.ms-app-card').count(),1);assert.equal(await p.locator('.ms-card-title').innerText(),'Stop at 10');await shot('store-search-final');
 await p.getByRole('searchbox').fill('no-such-game');assert.ok(await p.getByText('No results found',{exact:true}).isVisible());await p.getByRole('button',{name:'Clear search'}).click();assert.equal(await p.getByRole('searchbox').inputValue(),'');
 await p.getByRole('button',{name:'View Memory Grid',exact:true}).click();assert.ok(await p.getByText('How to play',{exact:true}).isVisible());assert.ok(await p.getByRole('button',{name:'Install Memory Grid',exact:true}).isVisible());await shot('store-detail-final');await p.getByRole('button',{name:'Back',exact:true}).click();
 await p.locator('.ms-store-rail').getByRole('button',{name:'Apps',exact:true}).click();assert.equal(await p.locator('.store-game-row').count(),0);assert.ok(await p.locator('.ms-app-card').count()>=2);
 await p.locator('.ms-store-rail').getByRole('button',{name:'Library',exact:true}).click();await p.getByRole('button',{name:'Explore the store',exact:true}).click();
 await p.clock.install();await p.evaluate(()=>{const random=Math.random;Math.random=()=>.999999;document.querySelector('[data-install=memory]').click();Math.random=random;});
 const job=await p.evaluate(()=>JSON.parse(localStorage.getItem('vela.downloads.v1.games-qa')).memory);assert.ok(job.duration>=10000&&job.duration<=45000);assert.ok(job.duration>44000);
 await p.locator('.ms-store-rail').getByRole('button',{name:'Downloads',exact:true}).click();assert.equal(await p.locator('.ms-app-card').count(),1);await shot('store-downloads-final');await p.clock.fastForward(46000);await p.getByRole('button',{name:'Explore the store',exact:true}).waitFor();await p.locator('.ms-store-rail').getByRole('button',{name:'Library',exact:true}).click();await p.locator('.ms-store').getByRole('button',{name:'Open Memory Grid',exact:true}).waitFor();await shot('store-library-final');
 const second=await c.newPage();await second.goto(base);await second.waitForFunction(()=>!!window.qaHub);assert.equal(await second.locator('[data-hub-app=memory]').count(),1);await second.close();await p.bringToFront();
 await p.locator('.ms-store').getByRole('button',{name:'Open Memory Grid',exact:true}).click();await p.clock.fastForward(2800);await p.locator('.vg-menu').waitFor();
 // Authored audio files must decode, be assigned to the game mixer, and obey mute.
 const durations=await p.evaluate(async()=>{const {GAME_SOUNDS}=await import('/src/games/audio-data.mjs');return await Promise.all(Object.entries(GAME_SOUNDS).map(([name,src])=>new Promise((resolve,reject)=>{const audio=new Audio();audio.onloadedmetadata=()=>resolve({name,duration:audio.duration});audio.onerror=()=>reject(Error(name+' does not decode'));audio.src=src;})));});assert.equal(durations.length,8);assert.ok(durations.every(v=>v.duration>0));
 await p.locator('.vg [data-vg=sound]').click();assert.ok(await p.locator('audio[data-audio-app=memory]').evaluateAll(els=>els.every(a=>a.paused)));
 await p.locator('.vg [data-vg=sound]').click();await p.locator('.vg [data-vg=play]').hover();await p.clock.fastForward(500);assert.ok(await p.locator('audio[data-audio-app=memory]').count());
 console.log('PASS Microsoft Store navigation, search, empty results, details, hero, library, downloads, 45-second boundary and shared install state');console.log('PASS All eight authored sound effects decode; per-game mixer registration and mute');
 await p.getByRole('button',{name:'Close Memory Grid',exact:true}).click();
 for(const viewport of [{width:768,height:1024},{width:390,height:844}]){await p.setViewportSize(viewport);await p.locator('.ms-store-rail').getByRole('button',{name:'Home',exact:true}).click();await shot('store-'+viewport.width+'-final');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.getByRole('searchbox').fill('type');await p.getByRole('button',{name:'View Type Sprint',exact:true}).click();await shot('store-detail-'+viewport.width+'-final');}
 await p.clock.resume();assert.deepEqual(errors,[]);console.log('PASS Tablet/phone Store and detail layouts; no JavaScript errors');
 fs.writeFileSync(out+'/store-report.json',JSON.stringify({passed:true,errors,sounds:durations},null,2));
}catch(e){await p.screenshot({path:out+'/store-failure.png'});console.error((await p.locator('body').innerText()).slice(-1800));throw e;}finally{await browser.close();}
