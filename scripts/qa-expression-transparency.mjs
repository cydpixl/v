import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{port:0}});
await server.listen();
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.goto(server.resolvedUrls.local[0]);
 await page.evaluate(async()=>{
  for(const path of ['/src/style.css','/src/rich-composer.css','/src/desktop.css','/src/desktop-audio.css'])await import(path);
  const {messageHTML,renderEmoji,setExpressionLinks}=await import('/src/util.js');
  const {sizedEmoji}=await import('/src/emoji-size.js');
  setExpressionLinks({'transparent-gif':'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'});
  setExpressionLinks({'transparent-sticker':'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="gold"/><path d="M22 38 Q32 48 42 38" fill="none" stroke="black" stroke-width="3"/></svg>')});document.documentElement.dataset.theme='dark';
  document.body.innerHTML='<main class="single-chat-window mac-shell"><section class="chat-content" id="fixtures"></section></main>';
  const token='<:sticker:transparent-sticker>';
  const cases={gif:sizedEmoji('<:gif:transparent-gif>',128),resized:sizedEmoji(token,256),small:sizedEmoji(token,16),large:sizedEmoji(token,1000),multiple:sizedEmoji(token,64)+' '+sizedEmoji(token,64),original:token,mixed:'Hello '+sizedEmoji(token,64),plain:'Hello',missing:sizedEmoji('<:missing:unavailable>',64),code:'`hello` '+sizedEmoji(token,64)};
  for(const side of ['mine','incoming'])for(const [name,text]of Object.entries(cases))document.querySelector('#fixtures').insertAdjacentHTML('beforeend',`<article class="message ${side}" data-case="${name}"><div class="message-body"><div class="message-text">${messageHTML(text)}</div></div></article>`);
  renderEmoji(document.body);
  window.rerenderExpressions=()=>renderEmoji(document.body);
 });
 await mkdir('output/playwright',{recursive:true});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await page.addStyleTag({content:'html,body{height:auto!important;overflow:auto!important}main.single-chat-window{position:static!important;width:100%!important;height:auto!important;max-height:none!important}#fixtures{overflow:visible!important;height:auto!important}'});
  const results=await page.locator('.message').evaluateAll(rows=>rows.map(row=>{const text=row.querySelector('.message-text'),css=getComputedStyle(text);return {name:row.dataset.case,side:row.classList.contains('mine')?'mine':'incoming',transparent:css.backgroundColor==='rgba(0, 0, 0, 0)',padding:css.padding,classified:text.classList.contains('expression-only'),overflow:row.scrollWidth>row.clientWidth};}));
  for(const result of results){const expected=['gif','resized','small','large','multiple','original'].includes(result.name);assert.equal(result.classified,expected,JSON.stringify(result));assert.equal(result.transparent,expected,JSON.stringify(result));if(expected)assert.equal(result.padding,'0px');assert.equal(result.overflow,false,JSON.stringify(result));}
  await page.screenshot({path:`output/playwright/expression-transparency-${width}.png`,fullPage:true});
 }
 await page.evaluate(()=>{const text=document.querySelector('[data-case=resized] .message-text');text.innerHTML='Edited to text';window.rerenderExpressions();});
 assert.equal(await page.locator('[data-case=resized] .message-text').first().evaluate(el=>el.classList.contains('expression-only')),false);
 console.log('PASS: desktop/mobile expression transparency, mixed text, fallback, bounds and edit reset.');
}finally{await browser.close();await server.close();}
