import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const site=process.env.QA_SITE||'http://127.0.0.1:5195/v/';
const key=readFileSync(new URL('../src/auth.js',import.meta.url),'utf8').match(/apiKey:'([^']+)'/)[1];
const uid='profile-recovery-qa';
const email='taken_username@users.connections.invalid';
const accessToken='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({sub:uid,iat:Date.now()/1000,exp:Date.now()/1000+3600})).toString('base64url')+'.';
const browser=await chromium.launch({channel:'chrome'});

try{
 const fresh=await browser.newPage();
 const freshWrites=[];
 fresh.on('request',request=>{
  if(request.method()==='PUT'&&new URL(request.url()).pathname==='/api/me')freshWrites.push(request);
 });
 await fresh.goto(site);
 await fresh.getByRole('button',{name:'Yes',exact:true}).click();
 await fresh.getByRole('button',{name:'Yes',exact:true}).click();
 await fresh.getByRole('button',{name:'Continue',exact:true}).click();
 await fresh.getByRole('heading',{name:'Sign in to your desktop'}).waitFor();
 assert.deepEqual(freshWrites,[]);
 await fresh.close();

 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 page.setDefaultTimeout(10000);
 const writes=[];
 let profile=null;
 await page.addInitScript(({key,uid,email,accessToken})=>{
  localStorage.setItem('desktop.device.setup.v3','{"ready":true}');
  localStorage.setItem('desktop.setup.complete.'+uid,'1');
  if(sessionStorage.getItem('qa-seeded'))return;
  sessionStorage.setItem('qa-seeded','1');
  sessionStorage.setItem('pixl.signup',JSON.stringify({name:'Wrong account',handle:'taken_username'}));
  localStorage.setItem('firebase:authUser:'+key+':[DEFAULT]',JSON.stringify({
   uid,email,emailVerified:false,isAnonymous:false,providerData:[{providerId:'password',uid:email,email}],
   stsTokenManager:{accessToken,refreshToken:'qa-token',expirationTime:Date.now()+3600000},apiKey:key,appName:'[DEFAULT]'
  }));
 },{key,uid,email,accessToken});
 await page.route('https://identitytoolkit.googleapis.com/**',route=>route.fulfill({json:{users:[{localId:uid,email,providerUserInfo:[{providerId:'password',email}]}]}}));
 await page.route('**/api/**',async route=>{
  const request=route.request();
  const path=new URL(request.url()).pathname;
  if(path==='/api/me'){
   if(request.method()==='PUT'){
    const input=request.postDataJSON();
    writes.push(input);
    if(input.handle==='taken_username')return route.fulfill({status:409,json:{error:'That username is taken.'}});
    profile={uid,...input,status:'online'};
   }
   return route.fulfill({json:{user:profile}});
  }
  if(path==='/api/state')return route.fulfill({json:{user:profile,friends:[],conversations:[],blocks:[]}});
  return route.fulfill({json:{}});
 });
 await page.goto(site);
 const setup=page.getByRole('heading',{name:'Finish setting up your account'});
 const handle=page.getByRole('textbox',{name:/^username$/i});
 await setup.waitFor();
 assert.equal(await handle.inputValue(),'');
 await page.reload();
 await setup.waitFor();
 assert.deepEqual(writes,[]);

 await page.getByRole('textbox',{name:/^display name$/i}).fill('Profile Recovery QA');
 await handle.fill('taken_username');
 await page.getByRole('button',{name:'Save profile'}).click();
 await page.getByRole('alert').filter({hasText:'That username is taken.'}).waitFor();
 assert.equal(await handle.inputValue(),'taken_username');
 await handle.fill('available_name');
 await page.getByRole('button',{name:'Save profile'}).click();
 await page.locator('#vela-desktop').waitFor();
 await page.reload();
 await page.locator('#vela-desktop').waitFor();
 assert.deepEqual(writes.map(input=>input.handle),['taken_username','available_name']);

 profile=null;
 await page.reload();
 await page.getByRole('button',{name:'Use another account'}).click();
 await page.getByRole('heading',{name:'Sign in to your desktop'}).waitFor();
 await page.reload();
 await page.getByRole('heading',{name:'Sign in to your desktop'}).waitFor();
 assert.equal(writes.length,2);
 console.log('PASS fresh sign-in, restored session with no automatic profile write, duplicate username recovery, existing profile reload, and sign-out.');
}finally{await browser.close();}
