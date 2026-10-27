import assert from 'node:assert/strict';
const base='http://127.0.0.1:8787/api',suffix=Date.now().toString(36),a='social-a-'+suffix,b='social-b-'+suffix,c='social-c-'+suffix;
async function api(uid,path,method='GET',body,status=200){const response=await fetch(base+path,{method,headers:{Authorization:'Bearer test:'+uid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
for(const uid of [a,b,c])await api(uid,'/me','PUT',{handle:uid.replaceAll('-','_'),name:uid});
await api(a,'/friends','POST',{handle:b.replaceAll('-','_')});const pending=(await api(b,'/state')).friends.find(f=>f.uid===a);await api(b,'/friends/'+pending.id,'PATCH',{action:'accept'});
const cid=(await api(a,'/conversations','POST',{members:[b]})).id;
const messages=[];for(let i=0;i<42;i++){const id=crypto.randomUUID();messages.push(id);await api(i%2?a:b,'/conversations/'+cid+'/messages','POST',{id,text:'Social '+i+' https://www.tiktok.com/@scout2015/video/6718335390845095173'});}
let page=await api(b,'/social/posts');assert.equal(page.posts.length,40);assert.ok(page.next);const second=await api(b,'/social/posts?'+new URLSearchParams(page.next));assert.equal(second.posts.length,2);assert.equal(new Set([...page.posts,...second.posts].map(m=>m.id)).size,42);
assert.equal((await api(c,'/social/posts')).posts.length,0);await api(c,'/social/posts?conversation='+cid,'GET',undefined,404);
await api(b,'/hidden-messages','POST',{id:messages[41]});assert.ok(!(await api(b,'/social/posts')).posts.some(m=>m.id===messages[41]));assert.ok((await api(a,'/social/posts')).posts.some(m=>m.id===messages[41]));
await api(b,'/messages/'+messages[40],'DELETE');assert.ok(!(await api(b,'/social/posts')).posts.some(m=>m.id===messages[40]));
await api(a,'/social/resolve','POST',{url:'https://127.0.0.1/private'},400);
const resolved=await api(a,'/social/resolve','POST',{url:'https://www.tiktok.com/@scout2015/video/6718335390845095173?tracking=removed'});assert.equal(resolved.post.id,'6718335390845095173');assert.ok(!resolved.post.url.includes('?'));
console.log('PASS authenticated social feed, recipient access, outsider denial, pagination without duplicates, private hidden messages, deleted posts, resolver validation and canonicalization');
