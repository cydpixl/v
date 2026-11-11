import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';

const site=process.env.QA_SITE||'http://127.0.0.1:5195/v/';
const worker=new URL(process.env.QA_API||'http://127.0.0.1:8791');
assert.equal(worker.hostname,'127.0.0.1','Use a loopback Worker for synthetic accounts');
const apiOrigin=readFileSync('.env.github','utf8').match(/VITE_API_ORIGIN=(\S+)/)[1];
const key=readFileSync('src/auth.js','utf8').match(/apiKey:'([^']+)'/)[1];
const suffix=Date.now().toString(36);
const [sender,recipient,existing]=['Sender','Recipient','Existing'].map(name=>({name,handle:name.toLowerCase()+'_'+suffix,uid:name.toLowerCase()+'-'+suffix}));

async function api(person,path,method='GET',body){
 const response=await fetch(new URL('/api'+path,worker),{method,headers:{Authorization:'Bearer test:'+person.uid,'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
 const data=await response.json();
 assert.ok(response.ok,`${method} ${path}: ${JSON.stringify(data)}`);
 return data;
}
for(const person of [sender,recipient,existing])await api(person,'/me','PUT',{name:person.name,handle:person.handle});
await api(sender,'/friends','POST',{handle:existing.handle});
const {friends:[initialRequest]}=await api(existing,'/state');
await api(existing,'/friends/'+initialRequest.id,'PATCH',{action:'accept'});

const browser=await (process.env.QA_WEBKIT?webkit.launch():chromium.launch({channel:'chrome'}));
async function openMessages(person,viewport){
 const context=await browser.newContext({viewport,serviceWorkers:'block'});
 const page=await context.newPage();
 page.setDefaultTimeout(12000);
 const email=person.handle+'@users.connections.invalid';
 const accessToken='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({sub:person.uid,iat:Date.now()/1000,exp:Date.now()/1000+3600})).toString('base64url')+'.';
 await page.addInitScript(({key,uid,email,accessToken})=>{
  localStorage.setItem('desktop.device.setup.v3','{"ready":true}');
  localStorage.setItem('desktop.setup.complete.'+uid,'1');
  localStorage.setItem('firebase:authUser:'+key+':[DEFAULT]',JSON.stringify({uid,email,emailVerified:false,isAnonymous:false,providerData:[{providerId:'password',uid:email,email}],stsTokenManager:{accessToken,refreshToken:'qa-token',expirationTime:Date.now()+3600000},apiKey:key,appName:'[DEFAULT]'}));
 },{key,uid:person.uid,email,accessToken});
 await page.route('https://identitytoolkit.googleapis.com/**',route=>route.fulfill({json:{users:[{localId:person.uid,email,providerUserInfo:[{providerId:'password',email}]}]}}));
 await page.route(apiOrigin+'/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const response=await fetch(new URL(url.pathname+url.search,worker),{method:request.method(),headers:{Authorization:'Bearer test:'+person.uid,'Content-Type':request.headers()['content-type']||'application/json'},body:request.postDataBuffer()||undefined});
  await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/json',body:Buffer.from(await response.arrayBuffer())});
 });
 let socketReady;
 const ready=new Promise(resolve=>{socketReady=resolve;});
 await page.routeWebSocket(/\/api\/live\?/,socket=>{
  const url=new URL(new URL(socket.url()).search,worker);
  url.protocol='ws:';url.pathname='/api/live';
  const upstream=new WebSocket(url);
  upstream.addEventListener('open',socketReady);
  upstream.addEventListener('message',event=>socket.send(event.data));
  upstream.addEventListener('error',()=>socket.close());
  upstream.addEventListener('close',()=>socket.close());
  socket.onClose(()=>upstream.close());
  socket.onMessage(message=>{if(upstream.readyState===WebSocket.OPEN)upstream.send(message);});
 });
 await page.goto(site);
 await page.getByRole('button',{name:'Open Messages',exact:true}).click();
 await Promise.race([ready,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Live socket did not connect')),12000);timer.unref();})]);
 return page;
}

try{
 const [from,to]=await Promise.all([openMessages(sender,{width:1280,height:720}),openMessages(recipient,{width:390,height:844})]);
 const fromDialog=from.getByRole('dialog',{name:'Friends'}),toDialog=to.getByRole('dialog',{name:'Friends'});
 await from.getByRole('textbox',{name:'Message Existing'}).waitFor();
 await from.getByRole('button',{name:'Friends',exact:true}).click();
 const input=fromDialog.getByRole('textbox',{name:'Vela username'});
 const send=fromDialog.getByRole('button',{name:'Send Friend Request'});
 await input.fill('missing_'+suffix);
 await send.click();
 await fromDialog.getByText('No account has that username.').waitFor();
 await input.fill('@'+recipient.handle.toUpperCase());
 await send.click();
 await fromDialog.getByText('Friend request sent to @'+recipient.handle+'.').waitFor();
 await fromDialog.getByRole('button',{name:'Cancel Friend Request'}).waitFor();
 await input.fill(recipient.handle);
 await send.click();
 await fromDialog.getByText('A request is already pending.').waitFor();

 await to.getByRole('button',{name:'Friends, 1 incoming request',exact:true}).click();
 await toDialog.getByText('@'+sender.handle).waitFor();
 if(process.env.QA_SCREENSHOTS){
  mkdirSync(process.env.QA_SCREENSHOTS,{recursive:true});
  await from.screenshot({path:process.env.QA_SCREENSHOTS+'/friends-desktop.png'});
  await to.screenshot({path:process.env.QA_SCREENSHOTS+'/friends-mobile.png'});
 }
 await toDialog.getByRole('button',{name:'Accept Friend Request'}).click();
 await toDialog.getByRole('button',{name:'Message Sender',exact:true}).waitFor();
 await fromDialog.getByRole('button',{name:'Message Recipient',exact:true}).click();
 await fromDialog.waitFor({state:'hidden'});
 await from.getByRole('textbox',{name:'Message Recipient'}).waitFor();
 await toDialog.getByRole('button',{name:'Message Sender',exact:true}).click();
 await toDialog.waitFor({state:'hidden'});
 await to.getByRole('textbox',{name:'Message Sender'}).waitFor();
 assert.equal((await api(sender,'/state')).friends.filter(friend=>friend.status==='accepted').length,2);
 console.log('PASS Friends in full-screen Messages, missing and duplicate usernames, live request badge and acceptance, and opening the new chat on both accounts.');
}finally{await browser.close();}
