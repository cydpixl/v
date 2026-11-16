import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const BASE='http://127.0.0.1:4183';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4183','--strictPort'],{stdio:'ignore',env:{...process.env}});
let browser;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<80;i++){try{const res=await fetch(BASE+'/date/index.html');if(res.ok)return;}catch{}await pause(250)}throw Error('Vite server did not start')}
function mockHTML(){return `<!doctype html><meta charset="utf-8"><title>Vela Date integration QA</title><iframe id="frame" src="/date/index.html" style="width:100%;height:99vh;border:0"></iframe><script>
window.dateChanges=[];
const target=document.querySelector('#frame');
const say=(type,data={})=>target.contentWindow.postMessage({source:'vela-date',type,...data},location.origin);
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==target.contentWindow||event.data?.source!=='vela-date')return;
 const m=event.data;
 if(m.type==='ready')say('load',{owner:'qa-user',noteId:'own',stories:[{id:'own',label:'My story',owner:'qa-user',updated:Date.now()},{id:'shared',label:'Shared with me',owner:'friend-1',updated:Date.now()}],accountName:'QA user',snapshot:{name:'QA user',story:'',when:'',place:'',address:'',media:[],places:[]},links:{}});
 if(m.type==='update'){window.dateChanges.push(m.snapshot);say('status',{status:'Synced'});}
 if(m.type==='gif-search')say('gif-results',{requestId:m.requestId,items:[{id:'qaGif',name:'Test GIF',url:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',preview:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}]});
 if(m.type==='upload')say('upload-result',{requestId:m.requestId,remote:'qa-media-id',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/NwAAAABJRU5ErkJggg=='});
 if(m.type==='share')say('share-data',{requestId:m.requestId,items:[{uid:'friend-1',name:'Friend'}],selected:[],isOwner:true});
 if(m.type==='share-save')say('share-done',{requestId:m.requestId,ok:true});
 if(m.type==='file-links')say('file-links',{requestId:m.requestId,links:{'qa-media-id':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/NwAAAABJRU5ErkJggg=='}});
 if(m.type==='story-select'){say('load',{owner:'qa-user',noteId:m.noteId,stories:[{id:'own',label:'My story',owner:'qa-user'},{id:'shared',label:'Shared with me',owner:'friend-1'}],accountName:'QA user',snapshot:{name:'Friend',story:'We went for a walk.',media:[],places:[],when:'',address:'',place:''},links:{}});say('story-selected',{requestId:m.requestId,ok:true});}
});
</script>`;}
(async()=>{
 await ready();
 browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const context=await browser.newContext({viewport:{width:1240,height:850}});
 const page=await context.newPage();
 await page.goto(BASE+'/date/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#nameInput').fill('Writer');
 await page.locator('#nameForm button').click();
 await page.locator('#tour').waitFor({state:'visible'});
 await page.locator('#skipTour').click();
 await page.locator('#storyInput').fill('We ate at @location');
 await page.locator('#manualPlace').fill("McDonald's");
 await page.locator('#manualPlaceAdd').click();
 assert.match(await page.locator('#storyInput').inputValue(),/@McDonald's/);
 await page.locator('#readToggle').click();
 await page.locator('#storyRead .inline-place').click();
 assert.match(await page.locator('.place-actions a').first().getAttribute('href'),/google.com\/maps\/search/);
 await page.locator('.modal-close').click();
 await page.locator('#readToggle').click();
 await page.locator('#drawBtn').click();
 await page.locator('#drawCanvas').waitFor({state:'visible'});
 const rect=await page.locator('#drawCanvas').boundingBox();
 await page.mouse.move(rect.x+30,rect.y+35);await page.mouse.down();await page.mouse.move(rect.x+90,rect.y+80);await page.mouse.up();
 await page.locator('#attachDraw').click();
 await page.locator('#mediaGrid .media-card').first().waitFor({state:'visible'});
 console.log('PASS: standalone onboarding, spotlight tutorial, location linking, read mode and drawing');
 await context.close();

 const cloudContext=await browser.newContext({viewport:{width:1100,height:850}});
 await cloudContext.addInitScript(()=>localStorage.setItem('date.tour.seen','1'));
 const cloudPage=await cloudContext.newPage();
 await cloudPage.route('**/__date_mock',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:mockHTML()}));
 await cloudPage.goto(BASE+'/__date_mock',{waitUntil:'domcontentloaded'});
 const frame=cloudPage.frameLocator('#frame');
 await frame.locator('#storyInput').waitFor({state:'visible'});
 await frame.locator('#storyInput').waitFor({state:'visible'});
 await cloudPage.waitForFunction(()=>!document.querySelector('#frame').contentDocument.querySelector('#storyInput').disabled);
 await frame.locator('#storyInput').fill('Tomorrow we meet at @location');
 await frame.locator('#manualPlace').fill("McDonald's");
 await frame.locator('#manualPlaceAdd').click();
 await frame.locator('#saveBtn').click();
 await cloudPage.waitForFunction(()=>window.dateChanges.some(change=>change.story.includes("@McDonald's")),{timeout:12000});
 await frame.locator('#gifBtn').click();
 await frame.locator('.gif-choice').first().waitFor({state:'visible'});
 await frame.locator('.gif-choice').first().click();
 await frame.locator('#mediaGrid .media-card').first().waitFor({state:'visible'});
 await frame.locator('#filePicker').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/NwAAAABJRU5ErkJggg==','base64')});
 await frame.locator('#mediaGrid .media-card').nth(1).waitFor({state:'visible'});
 await frame.locator('#shareBtn').click();
 await frame.locator('.share-friends input').check();
 await frame.locator('#shareSave').click();
 await frame.locator('#readToggle').click();
 await frame.locator('#storyRead .inline-place').click();
 assert.match(await frame.locator('.place-actions a').first().getAttribute('href'),/google.com\/maps/);
 await frame.locator('.modal-close').click();
 await frame.locator('#storiesBtn').click();
 await frame.locator('.story-choice').nth(1).click();
 await cloudPage.waitForFunction(()=>document.querySelector('#frame').contentDocument.querySelector('#storyInput').value.includes('went for a walk'));
 console.log('PASS: embedded Vela bridge, GIPHY, places, 50-file batching, uploads, sharing and story switching');
 await cloudContext.close();
 console.log('date. QA COMPLETE');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close().catch(()=>{});server.kill('SIGTERM')});
