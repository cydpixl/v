import assert from 'node:assert/strict';
const base=process.env.QA_API||'http://127.0.0.1:8787/api';
const suffix=Date.now().toString(36),a='rel-a-'+suffix,b='rel-b-'+suffix,c='rel-c-'+suffix;
async function api(uid,path,method='GET',body,status=200){
 const response=await fetch(base+path,{method,headers:{Authorization:'Bearer test:'+uid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await response.json();assert.equal(response.status,status,JSON.stringify({path,data}));return data;
}
for(const uid of [a,b,c])await api(uid,'/me','PUT',{handle:uid.replaceAll('-','_'),name:uid});
await api(a,'/friends','POST',{handle:b.replaceAll('-','_')});
let state=await api(b,'/state');await api(b,'/friends/'+state.friends[0].id,'PATCH',{action:'accept'});
const cid=[a,b].sort().join(':'),path='/conversations/'+encodeURIComponent(cid);
const id=crypto.randomUUID();await api(a,path+'/messages','POST',{id,text:'Before blocking'});
for(const status of ['idle','dnd','invisible','online']){
 assert.equal((await api(a,'/me','PUT',{status})).user.status,status);
 assert.equal((await api(a,'/state')).user.status,status);
 const peer=(await api(b,'/state')).friends.find(f=>f.uid===a);
 assert.equal(peer.presence,['dnd','invisible'].includes(status)?'offline':status);
}
await api(a,'/profile-extras/'+a,'PUT',{status:'Custom status persists'});
assert.equal((await api(b,'/state')).conversations[0].members.find(m=>m.uid===a).custom_status,'Custom status persists');
const call=(await api(a,path+'/calls','POST',{kind:'voice'})).call;
await api(a,'/calls/'+call.id+'/join','POST',{device:'test-device-123'});
const scheduled=crypto.randomUUID();await api(a,'/scheduled-messages','POST',{id:scheduled,conversation:cid,text:'Should not be delivered',deliverAt:Date.now()+31000},201);
await api(a,'/blocks','POST',{target:b,blocked:'false'},400);
await api(a,'/blocks','POST',{target:b,blocked:true});
state=await api(a,'/state');
assert.equal(state.blocks[0].name,b);assert.equal(state.blocks[0].handle,b.replaceAll('-','_'));
assert.equal(state.conversations[0].blocked,true);assert.equal(state.conversations[0].blockedBy,false);assert.equal(state.conversations[0].call,null);
assert.equal(state.friends.find(f=>f.uid===b).status,'accepted');assert.equal(state.friends.find(f=>f.uid===b).presence,'offline');
state=await api(b,'/state');assert.equal(state.conversations[0].blockedBy,true);assert.equal(state.blocks.length,0);assert.equal(state.blockedBy[0].target,a);
assert.deepEqual((await api(c,'/state')).blockedBy,[]);
for(const uid of [a,b]){
 await api(uid,path+'/messages','POST',{id:crypto.randomUUID(),text:'Blocked'},403);
 await api(uid,path+'/typing','POST',{typing:true},403);
 await api(uid,path+'/read','POST',{},403);
 await api(uid,path+'/calls','POST',{kind:'voice'},403);
 await api(uid,'/calls/'+call.id+'/join','POST',{device:'test-device-123'},403);
 await api(uid,'/ticket','POST',{scope:'call:'+call.id},410);
 await api(uid,'/scheduled-messages','POST',{id:crypto.randomUUID(),conversation:cid,text:'Blocked scheduled',deliverAt:Date.now()+60000},403);
}
assert.ok((await api(b,path+'/messages')).messages.some(m=>m.id===id),'Existing history is retained');
// Verify the cron delivery path also respects a block made after scheduling.
await new Promise(resolve=>setTimeout(resolve,32000));
const cron=await fetch(new URL('/cdn-cgi/local/explorer/api/local/scheduled?worker=vela-cyd',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cron:'* * * * *'})});const invocation=await cron.json();assert.ok(cron.ok,JSON.stringify(invocation));
assert.equal((await api(a,'/scheduled-messages')).items.some(m=>m.id===scheduled),false);
assert.equal((await api(b,path+'/messages')).messages.some(m=>m.id===scheduled),false);
await api(b,'/blocks','POST',{target:a,blocked:true});await api(a,'/blocks','POST',{target:b,blocked:false});
assert.equal((await api(a,'/state')).conversations[0].blockedBy,true);
await api(a,path+'/messages','POST',{id:crypto.randomUUID(),text:'Still blocked'},403);
await api(b,'/blocks','POST',{target:a,blocked:false});
state=await api(a,'/state');assert.equal(state.conversations[0].communicationBlocked,false);
await api(a,path+'/messages','POST',{id:crypto.randomUUID(),text:'Messaging restored'});

console.log('PASS status persistence/privacy/custom text, named blocked list, directional/mutual blocks, history, message/typing/read/call/schedule restrictions, call eviction and unblock recovery');
