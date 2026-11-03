import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const qa=JSON.parse(fs.readFileSync('C:/Users/jayme/Downloads/Vela-controls-repair/.private/qa.json'));
const key=fs.readFileSync('src/auth.js','utf8').match(/apiKey:'([^']+)'/)[1];
const expected=JSON.parse(fs.readFileSync('worker/default-music.json','utf8'));
const origin='https://vela-desktop.cydpixl7.workers.dev',site=process.env.QA_SITE||'https://cydpixl.github.io/v/';
const accounts=await Promise.all(qa.users.slice(0,2).map(async person=>{
 const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:person.handle+'@users.connections.invalid',password:qa.password,returnSecureToken:true})}).then(r=>r.json());
 assert.ok(login.idToken,'QA sign-in failed');
 const response=await fetch(origin+'/api/music-library',{headers:{Authorization:'Bearer '+login.idToken}});assert.equal(response.status,200);
 const library=await response.json();assert.equal(library.items.length,expected.length);assert.deepEqual(library.items.map(t=>t.id),expected.map(t=>t.id));
 assert.ok(library.items.every(t=>t.fullLength&&t.audio&&t.artwork&&t.duration>30));
 return {...person,uid:login.localId,tracks:library.items};
}));
console.log('PASS both accounts receive all '+expected.length+' full-length songs in Playlist One.');
const pending=[...accounts[0].tracks];
await Promise.all(Array.from({length:3},async()=>{while(pending.length){const track=pending.shift();
 const media=await fetch(track.audio,{headers:{Range:'bytes=0-1023'}});assert.equal(media.status,206,track.title);assert.equal(Number(media.headers.get('content-length')),1024);assert.ok(media.headers.get('content-range').endsWith('/'+track.size));assert.equal((await media.arrayBuffer()).byteLength,1024);
 const art=await fetch(track.artwork);assert.equal(art.status,200,track.title+' artwork');assert.ok(art.headers.get('content-type').startsWith('image/'));await art.arrayBuffer();
}}));
assert.equal((await fetch(origin+'/api/shared-music/'+expected[0].id)).status,401);
console.log('PASS every audio file supports authenticated seeking and every album cover loads.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const account=accounts[1],context=await browser.newContext({viewport:{width:1440,height:940},serviceWorkers:'block'});
 await context.addInitScript(uid=>{localStorage.setItem('desktop.device.setup.v3','{"ready":true}');localStorage.setItem('desktop.setup.complete.'+uid,'1');localStorage.setItem('vela.auto-fullscreen','off');localStorage.setItem('vela.installed.'+uid,JSON.stringify(['music']));window.__musicState=null;window.addEventListener('vela-player-state',event=>window.__musicState={title:event.detail.track?.title,playing:event.detail.playing,position:event.detail.position,duration:event.detail.duration,error:event.detail.error})},account.uid);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(site);await page.locator('[name=handle]').fill(account.handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.locator('#composer').waitFor({timeout:45000});
 await page.waitForFunction(()=>document.body.classList.contains('chat-app-hidden'),{timeout:20000});
 await page.locator('.desktop-apps').getByRole('button',{name:'Open Music',exact:true}).click();
 await page.waitForFunction(count=>document.querySelectorAll('.am-track[data-track-id]').length===count,expected.length);
 const song=account.tracks.find(track=>track.title==='Let You Go');assert.ok(song);
 await page.getByRole('button',{name:'Play '+song.title+' by '+song.artist,exact:true}).click();
 await page.waitForFunction(title=>window.__musicState?.title===title&&window.__musicState.playing&&window.__musicState.position>2,song.title,{timeout:30000});
 const state=await page.evaluate(()=>window.__musicState);assert.ok(state.duration>150);assert.equal(state.error,null);
 fs.mkdirSync('output/playwright',{recursive:true});await page.screenshot({path:'output/playwright/shared-music-release.png'});
 assert.deepEqual(errors,[]);console.log('PASS main-site Chrome displays '+expected.length+' songs and plays newly added full-length audio without JavaScript errors.');
}finally{await browser.close()}
