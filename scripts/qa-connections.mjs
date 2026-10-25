import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8'));
const site=process.env.QA_SITE||'http://127.0.0.1:5178';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const errors=[],pages=[];fs.mkdirSync('output/connections',{recursive:true});
try{
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:{width:1536,height:960},permissions:['microphone','camera']});
  await context.addInitScript(()=>{localStorage.setItem('vela.theme','graphite');localStorage.setItem('vela.theme.chosen','1')});
  const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',error=>errors.push(error.message));pages.push(page);
  await page.goto(site);await page.locator('[name=handle]').fill(qa.users[i].handle);await page.locator('[name=password]').fill(qa.password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.getByRole('button',{name:'Tools & uploads',exact:true}).waitFor();
 }
 const [a,b]=pages;
 const uid=await b.evaluate(()=>window.__pixl.state.user.uid);
 await a.evaluate(async handle=>{try{await window.__pixl.api('/friends',{method:'POST',body:{handle}})}catch(error){if(!/already|pending/.test(error.message))throw error}},qa.users[1].handle);
 await b.evaluate(async()=>{const state=await window.__pixl.api('/state');for(const f of state.friends)if(f.status==='pending'&&f.requested_by!==state.user.uid)await window.__pixl.api('/friends/'+encodeURIComponent(f.id),{method:'PATCH',body:{action:'accept'}})});
 const cid=await a.evaluate(async uid=>(await window.__pixl.api('/conversations',{method:'POST',body:{members:[uid]}})).id,uid);
 for(const page of pages){await page.reload();await page.getByRole('button',{name:'Tools & uploads',exact:true}).waitFor();await page.locator('[data-open="'+cid+'"]').first().click();await page.locator('#composer').waitFor()}
 console.log('PASS login and existing conversation');
 const text='Parity QA '+Date.now()+' **bold** *italic* __underline__ ~~strike~~ ||secret||';await a.locator('#composer').fill(text);await a.getByRole('button',{name:'Send Message',exact:true}).click();const row=a.locator('.message').filter({hasText:'Parity QA'}).last();await row.locator('strong').filter({hasText:'bold'}).waitFor();await row.locator('em').filter({hasText:'italic'}).waitFor();await row.locator('.text-spoiler').click();assert.equal(await row.locator('.text-spoiler').getAttribute('aria-expanded'),'true');
 await row.locator('.message-text').waitFor();await a.waitForFunction(()=>!document.querySelector('.message.pending'));await row.locator('.message-text').click({button:'right'});await a.getByRole('menuitem',{name:'Save Message',exact:true}).click();await a.getByRole('button',{name:'Saved Messages',exact:true}).click();await a.getByText(text).first().waitFor();await a.locator('[data-open="'+cid+'"]').first().click();
 console.log('PASS markdown, spoilers, right-click and saved message');
 await a.getByRole('button',{name:'Tools & uploads',exact:true}).click();await a.getByRole('button',{name:'Search everything',exact:true}).click();await a.getByRole('searchbox',{name:'Search Vela',exact:true}).fill('Parity QA');await a.locator('.connection-results>button').filter({hasText:'Parity QA'}).first().click();await a.locator('.message-flash').waitFor();
 console.log('PASS global search and exact message jump');
 await a.locator('#file-input').setInputFiles([{name:'first.txt',mimeType:'text/plain',buffer:Buffer.from('first attachment')},{name:'second.txt',mimeType:'text/plain',buffer:Buffer.from('second attachment')}]);await a.locator('#upload-preview').getByText(/2 files/).waitFor();await a.getByRole('button',{name:'Send Message',exact:true}).click();await b.locator('.message-attachments').last().getByText('second.txt',{exact:true}).waitFor();
 console.log('PASS multi-file multipart upload and real-time delivery');
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=','base64');await a.locator('#file-input').setInputFiles({name:'gallery-photo.png',mimeType:'image/png',buffer:image});await a.locator('#upload-preview').getByText(/gallery-photo.png/).waitFor();await a.getByRole('button',{name:'Send Message',exact:true}).click();await b.getByRole('img',{name:'gallery-photo.png',exact:true}).last().scrollIntoViewIfNeeded();await b.getByRole('img',{name:'gallery-photo.png',exact:true}).last().waitFor();await a.getByRole('button',{name:'Media',exact:true}).click();await a.getByRole('dialog',{name:'Shared media'}).getByRole('img',{name:'gallery-photo.png',exact:true}).first().waitFor();await a.getByRole('dialog',{name:'Shared media'}).getByRole('button',{name:'Close',exact:true}).click();
 console.log('PASS conversation gallery with private file links');
 await a.getByRole('button',{name:'Tools & uploads',exact:true}).click();await a.getByRole('button',{name:'Profile extras',exact:true}).click();await a.getByRole('textbox',{name:'Custom status',exact:true}).fill('Parity status');await a.getByRole('button',{name:'Save status',exact:true}).click();await a.locator('[data-profile-game="tic-tac-toe"]').check();await a.getByRole('button',{name:'Save games',exact:true}).click();await a.getByRole('button',{name:'Tic tac toe',exact:true}).click();await a.getByRole('button',{name:'Cell 1',exact:true}).click();await a.locator('.inline-game-status').filter({hasText:/Your turn|AI wins|You win/}).waitFor();await a.getByRole('button',{name:'Edit drawing',exact:true}).click();const canvas=a.locator('.profile-drawing-editor');const rect=await canvas.boundingBox();await a.mouse.move(rect.x+20,rect.y+20);await a.mouse.down();await a.mouse.move(rect.x+140,rect.y+90,{steps:6});await a.mouse.up();await a.getByRole('button',{name:'Save drawing',exact:true}).click();await a.getByRole('dialog',{name:'Profile drawing',exact:true}).waitFor({state:'hidden'});await a.locator('img.profile-drawing').waitFor();
 console.log('PASS custom status, playable game and saved public drawing');
 await a.screenshot({path:'output/connections/profile.png'});await a.getByRole('dialog').last().getByRole('button',{name:'Close',exact:true}).click();
 await a.getByRole('button',{name:'Record voice message',exact:true}).click();await a.getByRole('button',{name:'Stop recording',exact:true}).waitFor({state:'visible'});await a.waitForTimeout(1200);await a.getByRole('button',{name:'Stop recording',exact:true}).click();await a.getByRole('button',{name:'Send voice message',exact:true}).click();await b.locator('.message audio').last().waitFor();
 console.log('PASS microphone recording, preview and voice-message delivery');
 await a.getByRole('button',{name:'Take a Photo',exact:true}).click();await a.getByRole('button',{name:'Grid',exact:true}).click();await a.locator('[data-timer]').selectOption('3');await a.getByRole('button',{name:'Take Photo',exact:true}).click();await a.locator('.camera-countdown').waitFor({state:'visible'});await a.getByRole('button',{name:'Send Photo',exact:true}).waitFor();await a.getByRole('dialog',{name:'Take a Photo'}).getByRole('button',{name:'Close',exact:true}).click();
 console.log('PASS camera grid and countdown');
 assert.deepEqual(errors,[]);await a.screenshot({path:'output/connections/chat.png'});
 console.log(JSON.stringify({ok:true,errors}));
}catch(error){for(const [i,page]of pages.entries()){await page.screenshot({path:'output/connections/failure-'+i+'.png'});console.log('PAGE',i,await page.locator('body').innerText().then(x=>x.slice(-3000)));}console.log('ERRORS',errors);throw error;}finally{await browser.close()}
