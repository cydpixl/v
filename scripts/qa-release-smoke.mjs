import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('docs');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(!path.startsWith('/v/')){res.writeHead(404);res.end();return;}
  let target=resolve(root,decodeURIComponent(path.slice(3))||'index.html');
  if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{const bytes=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});res.end(bytes)}catch{res.writeHead(404);res.end('Not found')}
});
await new Promise((yes,no)=>server.once('error',no).listen(0,'127.0.0.1',yes));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const broken=[];
 await page.addInitScript(()=>{window.__velaLongTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__velaLongTasks.push(e.duration)}).observe({type:'longtask',buffered:true})});
 page.on('response',r=>{if(r.url().includes('127.0.0.1')&&r.status()>=400&&/\.(js|css|woff2|png|svg|html)/.test(r.url()))broken.push(`${r.status()} ${r.url()}`)});
 const url=`http://127.0.0.1:${server.address().port}/v/`;
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(17000); // The 15-second boot is intentional; leave untouched.
 await page.locator('#auth-form').waitFor({state:'visible',timeout:12000});
 if((await page.locator('#auth-form h1').innerText()).trim()!=='Welcome back!')throw Error('Normal sign-in screen did not appear');
 if(await page.locator('.windows-oobe,.desktop-boot-screen[data-phase=setup]').count())throw Error('Removed setup wizard appeared');
 console.log('PASS: normal sign-in, no forced country/device or desktop profile setup.');
 const state=await page.evaluate(()=>({title:document.title,body:document.body.innerText.slice(0,250),longTaskMS:Math.round((window.__velaLongTasks||[]).reduce((a,b)=>a+b,0)),domMs:Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd||0)}));
 console.log('Production preview:',JSON.stringify(state));
 if(response?.status()!==200||!documentIsVela(state.title))throw Error('Website entry failed to load');
 if(broken.length)throw Error('Local static assets missing: '+broken.slice(0,8).join('; '));
 if(state.longTaskMS>1200)throw Error('Excessive main-thread long tasks in browser smoke test: '+state.longTaskMS+'ms');
 console.log('PASS: /v/ entry, assets and startup responsiveness. Boot timing preserved.');
} finally {await browser?.close();await new Promise(yes=>server.close(yes))}
function documentIsVela(t){return /vela/i.test(t)}
