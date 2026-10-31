import fs from 'node:fs';import assert from 'node:assert/strict';
const qa=JSON.parse(fs.readFileSync('.private/qa.json','utf8')),base='https://vela-cyd.cydpixl7.workers.dev',key=fs.readFileSync('src/auth.js','utf8').match(/apiKey:'([^']+)'/)[1];
const tokens=await Promise.all(qa.users.slice(0,2).map(async u=>{const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.handle+'@users.connections.invalid',password:qa.password,returnSecureToken:true})});const d=await r.json();assert.ok(d.idToken);return d.idToken;}));
async function api(i,path,method='GET',body){const r=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+tokens[i],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.ok(r.ok,d.error||r.status);return d;}
const uid=qa.users[0].uid,cid=qa.users.slice(0,2).map(u=>u.uid).sort().join(':'),original=(await api(0,'/me')).user.status,id=crypto.randomUUID();let made=false;
try{
 await api(1,'/conversations/'+encodeURIComponent(cid)+'/messages','POST',{id,text:'Private status receipt verification'});made=true;
 for(const status of ['dnd','invisible']){
  await api(0,'/me','PUT',{status});await api(0,'/conversations/'+encodeURIComponent(cid)+'/read','POST');
  const state=await api(1,'/state'),member=state.conversations.find(c=>c.id===cid).members.find(u=>u.uid===uid),friend=state.friends.find(u=>u.uid===uid);
  assert.equal(member.status,'offline');assert.equal(member.last_seen,0);assert.equal(member.last_read,0);if(friend){assert.equal(friend.presence,'offline');assert.equal(friend.last_seen,0);}
  const profile=(await api(1,'/profiles/'+uid)).profile;assert.equal(profile.status,'offline');assert.equal(profile.last_seen,0);
  assert.equal((await api(0,'/me')).user.status,status);
  assert.equal((await api(0,'/conversations/'+encodeURIComponent(cid)+'/typing','POST',{typing:true})).ok,true);
 }
 await api(0,'/me','PUT',{status:'online'});
 const member=(await api(1,'/state')).conversations.find(c=>c.id===cid).members.find(u=>u.uid===uid),message=(await api(1,'/conversations/'+encodeURIComponent(cid)+'/messages')).messages.find(m=>m.id===id);
 assert.ok(member.last_read<message.created,'hidden reads do not become receipts on returning online');
 await api(0,'/conversations/'+encodeURIComponent(cid)+'/read','POST');assert.ok((await api(1,'/state')).conversations.find(c=>c.id===cid).members.find(u=>u.uid===uid).last_read>=message.created);
 console.log('PASS DND/invisible: offline presence in members/friends/profile, hidden timestamps/receipts, own status retained, no retroactive receipts, normal reads restored');
}finally{await api(0,'/me','PUT',{status:original}).catch(()=>{});if(made)await api(1,'/messages/'+id,'DELETE').catch(()=>{});}
