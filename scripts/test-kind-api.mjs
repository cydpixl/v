import assert from 'node:assert/strict';
import fs from 'node:fs';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8'));
const backend=process.env.QA_API||'https://vela-cyd.cydpixl7.workers.dev';
const authSource=fs.readFileSync('src/auth.js','utf8'),key=authSource.match(/apiKey:'([^']+)'/)[1];
const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:qa.users[0].handle+'@users.connections.invalid',password:qa.password,returnSecureToken:true})}).then(r=>r.json());
assert.ok(login.idToken,'QA account authenticated');
const cid=qa.users.slice(0,2).map(u=>u.uid).sort().join(':'),id=crypto.randomUUID(),scheduled=crypto.randomUUID();
async function api(path,method='GET',body){const r=await fetch(backend+'/api'+path,{method,headers:{Authorization:'Bearer '+login.idToken,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,data.error||`HTTP ${r.status}`);return data;}
try{
 const sent=await api('/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id,text:"You're stupid. This is F-U-C-K-I-N-G great."});
 assert.equal(sent.message.text,"You're smart. This is FREAKING great.");
 const again=await api('/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id,text:'you are ugly'});assert.equal(again.message.text,sent.message.text);
 await api('/messages/'+id,'PATCH',{text:"You're retarded. You're ugly."});
 const history=await api('/conversations/'+encodeURIComponent(cid)+'/messages');assert.equal(history.messages.find(m=>m.id===id).text,"You're capable. You're beautiful.");
 await api('/scheduled-messages','POST',{id:scheduled,conversation:cid,text:'This is fucking awesome.',deliverAt:Date.now()+3600000});
 const pending=await api('/scheduled-messages');assert.equal(pending.items.find(m=>m.id===scheduled).text,'This is freaking awesome.');
 console.log('PASS server API: raw profanity/insult rewrite, idempotent retry, edit rewrite and scheduled-message rewrite');
}finally{
 await api('/messages/'+id,'DELETE').catch(()=>{});
 await api('/scheduled-messages/'+scheduled,'DELETE').catch(()=>{});
}
