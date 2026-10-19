import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
const f=JSON.parse(fs.readFileSync('.private/qa.json')),site=process.env.QA_SITE||'http://127.0.0.1:5178/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const pages=[],errors=[];
try{
 for(let i=0;i<2;i++){const context=await browser.newContext({permissions:['microphone','camera'],viewport:{width:1600,height:1000}}),p=await context.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.goto(site);await p.locator('[name=handle]').fill(f.users[i].handle);await p.locator('[name=password]').fill(f.password);await p.locator('form button[type=submit]').click();await p.locator('.app-shell').waitFor();await p.locator('.dm-row').first().click()}
 const[a,b]=pages;await a.getByRole('button',{name:'Movies',exact:true}).first().click();await a.locator('.cinema-tile').first().waitFor();await a.getByRole('button',{name:'Close Movies',exact:true}).click();await a.locator('.dm-row').first().click();
 await a.getByRole('button',{name:'Start Video Call',exact:true}).click();await b.locator('.join-active-call').click();
 for(const p of pages)await p.locator('#voice-dock strong').filter({hasText:'Voice Connected'}).waitFor({timeout:30000});
 await a.locator('.call-tile.video-enabled').first().waitFor();
 assert.equal(await a.locator('.tile-fullscreen').count(),0);
 // The real analyser consumes Chrome's built-in test microphone signal.
 await a.locator('.call-tile.video-enabled.speaking').first().waitFor({timeout:15000});
 const outline=await a.locator('.call-tile.video-enabled.speaking').first().evaluate(el=>({border:getComputedStyle(el,'::after').borderTopWidth,z:getComputedStyle(el,'::after').zIndex}));
 assert.equal(outline.border,'3px');assert.equal(outline.z,'8');
 await a.locator('#call-controls [data-action=mute]').click();
 await a.waitForFunction(uid=>!document.querySelector('.call-tile[data-participant="'+uid+'"]')?.classList.contains('speaking'),f.users[0].uid);
 await a.getByRole('button',{name:'Attach a File',exact:true}).click();
 await a.getByRole('menuitem',{name:'Take a Photo',exact:true}).waitFor();
 await a.getByRole('menuitem',{name:'Upload a File',exact:true}).waitFor();
 await a.getByRole('menuitem',{name:'Upload Photos or Videos',exact:true}).waitFor();
 await a.getByRole('menuitem',{name:'Take a Photo',exact:true}).click();
 await a.locator('.camera-capture [data-capture]:enabled').waitFor();
 await a.locator('.camera-capture [data-capture]').click();await a.locator('.camera-capture img:not([hidden])').waitFor();
 await a.locator('[data-retake]').click();await a.locator('.camera-capture [data-capture]').click();
 await a.screenshot({path:'.private/camera-capture-preview.png',animations:'disabled'});
 const imageResponse=b.waitForResponse(response=>response.url().includes('/files/')&&response.status()===200);
 await a.locator('[data-send]').click();await a.locator('.camera-capture').waitFor({state:'detached'});
 await b.getByRole('button',{name:/View Photo-.*\.jpg/}).last().waitFor();await imageResponse;
 assert.ok(await a.locator('.call-tile.video-enabled video').first().evaluate(v=>v.srcObject?.active));
 const grip=a.getByRole('separator',{name:'Resize call area'}),bounds=await grip.boundingBox();
 const oldHeight=await a.locator('#call-stage').evaluate(el=>el.offsetHeight);
 await a.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await a.mouse.down();await a.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2+140,{steps:8});await a.mouse.up();
 const newHeight=await a.locator('#call-stage').evaluate(el=>el.offsetHeight);assert.ok(newHeight>oldHeight+80,{oldHeight,newHeight});
 await a.locator('#call-controls [data-action=call-movies]').click();
 await a.locator('.call-movie-picker [data-movie-tab=watch]').click();
 await a.getByRole('button',{name:'Watch Insidious',exact:true}).first().waitFor();
 assert.ok(await a.locator('.call-movie-picker').evaluate(el=>el.getBoundingClientRect().width)>1000);
 assert.equal(await a.locator('.call-movie-picker').evaluate(el=>getComputedStyle(el).backdropFilter.includes('blur')),true);
 await a.screenshot({path:'.private/call-movie-picker.png',animations:'disabled'});
 await a.getByRole('button',{name:'Watch Insidious',exact:true}).first().click();
 await a.locator('.call-movie-picker').waitFor({state:'detached'});await a.locator('#composer').waitFor();
 for(const p of pages){await p.locator('#call-tiles>#vela-movie-player.in-call-stage').waitFor();await p.waitForFunction(()=>{const v=document.querySelector('#vela-movie-player video');return v?.videoWidth>0&&v.currentTime>1},null,{timeout:90000})}
 await a.getByRole('button',{name:'Pause movie',exact:true}).click();await b.waitForFunction(()=>document.querySelector('#vela-movie-player video').paused);
 await a.getByRole('slider',{name:'Movie position',exact:true}).fill('60');await b.waitForFunction(()=>Math.abs(document.querySelector('#vela-movie-player video').currentTime-60)<1);
 for(const p of pages)await p.waitForFunction(()=>{const v=document.querySelector('#vela-movie-player video');return v.currentTime>55&&v.readyState>=2},null,{timeout:90000});await a.screenshot({path:'.private/movie-in-call-stage.png',animations:'disabled'});
 await a.locator('.call-tile.video-enabled').first().click();assert.ok(await a.locator('.call-tile.focused').count());
 await a.locator('#vela-movie-player header strong').click();await a.locator('#call-tiles.movie-focused').waitFor();
 for(const p of pages){await p.getByRole('button',{name:'Close movie',exact:true}).click();await p.locator('#call-controls [data-action=leave-call]').click()}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,site,checks:['camera speaking outline from analyser','photo capture retake and recipient image','call camera survives photo capture','three attachment options','pointer resizing','large glass movie picker','movie becomes call tile on both accounts','pause and seek sync','camera/movie focus','no per-camera fullscreen buttons'],errors}));
}catch(e){for(const[i,p]of pages.entries())await p.screenshot({path:'.private/call-workspace-failure-'+i+'.png',animations:'disabled'}).catch(()=>{});throw e}
finally{await browser.close()}
