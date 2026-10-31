import assert from 'node:assert/strict';import fs from 'node:fs';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8')),base='https://vela-cyd.cydpixl7.workers.dev',key=fs.readFileSync('src/auth.js','utf8').match(/apiKey:'([^']+)'/)[1];
const tokens=await Promise.all(qa.users.slice(0,2).map(async u=>{const d=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.handle+'@users.connections.invalid',password:qa.password,returnSecureToken:true})}).then(r=>r.json());assert.ok(d.idToken);return d.idToken;}));
async function api(i,path,method='GET',body,expected=200){const r=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+tokens[i],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.equal(r.status,expected,d.error||path);return d;}
const cid=qa.users.slice(0,2).map(u=>u.uid).sort().join(':'),id=crypto.randomUUID(),other=crypto.randomUUID(),scheduled=crypto.randomUUID();
try{
 const text='log out, loog outttt, idiot, stupid, fucking — unchanged';const sent=await api(0,'/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id,text});assert.equal(sent.message.text,text);assert.equal((await api(0,'/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id,text:'Retry'})).message.text,text);
 await api(0,'/messages/'+id,'PATCH',{text:'l o g o u t — still my words'});assert.equal((await api(0,'/conversations/'+encodeURIComponent(cid)+'/messages')).messages.find(m=>m.id===id).text,'l o g o u t — still my words');
 await api(1,'/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id:other,text:'Other member message'});await api(0,'/messages/'+other,'PATCH',{text:'Not authorized'},403);
 await api(0,'/admin/rewrite-rules','GET',undefined,403);assert.equal((await api(0,'/me','PUT',{site_admin:true})).user.site_admin,false);
 await api(0,'/scheduled-messages','POST',{id:scheduled,conversation:cid,text,deliverAt:Date.now()+3600000},201);assert.equal((await api(0,'/scheduled-messages')).items.find(m=>m.id===scheduled).text,text);
 console.log('PASS raw messages/edit/schedule unchanged; retries safe; members cannot edit others, access rules or grant themselves admin');
}finally{await api(0,'/messages/'+id,'DELETE').catch(()=>{});await api(1,'/messages/'+other,'DELETE').catch(()=>{});await api(0,'/scheduled-messages/'+scheduled,'DELETE').catch(()=>{});}
