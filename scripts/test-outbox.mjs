import assert from 'node:assert/strict';
import {createOutboxPump} from '../src/outbox.js';
import {messagePreview} from '../src/message-preview.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const state={user:{uid:'one'},outbox:[{id:'first'}]},gate=deferred(),sent=[];
const pump=createOutboxPump({state:()=>state,online:()=>true,send:async m=>{sent.push(m.id);if(m.id==='first')await gate.promise;return {id:m.id}},accept:()=>{},changed:()=>{}});
const draining=pump.flush();state.outbox.push({id:'second'});pump.flush();gate.resolve();await draining;
assert.deepEqual(sent,['first','second']);assert.equal(state.outbox.length,0);
state.outbox=[{id:'network',conversation:'a'},{id:'ordered',conversation:'a'},{id:'allowed',conversation:'b'},{id:'denied',conversation:'c'}];let clock=10000,attempts=0;
const accepted=[];
const retry=createOutboxPump({state:()=>state,online:()=>true,now:()=>clock,send:async m=>{if(m.id==='network'&&attempts++===0)throw new TypeError('Network lost');if(m.id==='denied')throw Object.assign(new Error('Forbidden'),{status:403});return {id:m.id}},accept:m=>accepted.push(m.id),changed:()=>{}});
await retry.flush();assert.deepEqual(accepted,['allowed']);assert.equal(state.outbox[0].pending,true);assert.equal(state.outbox[2].failed,true);
clock+=1001;await retry.flush();assert.deepEqual(accepted,['allowed','network','ordered']);assert.equal(state.outbox.length,1);retry.reset();
state.outbox=[{id:'account'}];const accountGate=deferred();const account=createOutboxPump({state:()=>state,online:()=>true,send:()=>accountGate.promise,accept:()=>assert.fail('Acknowledgement leaked across accounts'),changed:()=>assert.fail('Old account persisted into new account')});
const task=account.flush();state.user=null;state.outbox=[{id:'new-user'}];accountGate.resolve({id:'account'});await task;assert.equal(state.outbox[0].id,'new-user');account.reset();
assert.equal(messagePreview('',{kind:'sticker'}),'Sticker');assert.equal(messagePreview('',{kind:'gif'}),'GIF');assert.equal(messagePreview('',{type:'video/quicktime'}),'Video');assert.equal(messagePreview('<:cat:12345678-abcd>'),'Emoji');assert.equal(messagePreview('Hi <:cat:12345678-abcd>'),'Hi :cat:');

// Signing out and back into the same account must invalidate the old request too.
const sessionState={user:{uid:'same'},outbox:[{id:'old',conversation:'a'}]},oldGate=deferred(),newGate=deferred(),sessionAccepted=[];
const sessions=createOutboxPump({state:()=>sessionState,online:()=>true,send:m=>m.id==='old'?oldGate.promise:newGate.promise,accept:m=>sessionAccepted.push(m.id),changed:()=>{}});
const oldTask=sessions.flush();sessions.reset();sessionState.user={uid:'same'};sessionState.outbox=[{id:'new',conversation:'a'}];
const newTask=sessions.flush();assert.notEqual(oldTask,newTask,'New session must not wait for the old network request');
oldGate.resolve({id:'old'});await oldTask;assert.deepEqual(sessionAccepted,[]);assert.equal(sessionState.outbox[0].id,'new');assert.equal(sessions.flush(),newTask,'Old completion must not unlock the new pump');
newGate.resolve({id:'new'});await newTask;assert.deepEqual(sessionAccepted,['new']);sessions.reset();

// A blocked follower with an expired retry must not schedule a tight 1ms loop.
const savedSetTimeout=globalThis.setTimeout,delays=[];
globalThis.setTimeout=(fn,delay)=>{delays.push(delay);return savedSetTimeout(fn,60000);};
try{
 const blockedState={user:{uid:'one'},outbox:[{id:'head',conversation:'a',retryAt:15000},{id:'follower',conversation:'a',retryAt:9000},{id:'other',conversation:'b',retryAt:12000}]};
 const blocked=createOutboxPump({state:()=>blockedState,online:()=>true,now:()=>10000,send:()=>assert.fail('No message is eligible'),accept:()=>{},changed:()=>{}});
 await blocked.flush();blocked.reset();assert.deepEqual(delays,[2000]);
}finally{globalThis.setTimeout=savedSetTimeout;}
console.log('PASS: enqueue during send, drain without another click, network retry, permanent failure, account isolation, media/sidebar labels');
console.log('PASS: same-account session reset, independent new-session pump, ordered retry wakeups without busy loops');
