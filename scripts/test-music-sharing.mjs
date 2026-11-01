import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {catalogSong,createSongMessage,parseSongMessage,songMarkup,matchingSong} from '../src/song-model.mjs';
import {listeningHistoryAPI} from '../worker/listening-history.js';
import {createListeningTracker} from '../src/listening-tracker.js';

const sample={kind:'song',trackId:1781270323,trackName:'luther',artistName:'Kendrick Lamar',collectionName:'GNX',previewUrl:'https://audio-ssl.itunes.apple.com/test.m4a',artworkUrl100:'https://is1-ssl.mzstatic.com/image/100x100bb.jpg',trackViewUrl:'https://music.apple.com/us/album/luther/1781270319?i=1781270323'};
const song=catalogSong(sample),token=createSongMessage(song);assert.deepEqual(parseSongMessage(token),song);assert.ok(token.length<3900);assert.match(song.artwork,/600x600/);assert.match(songMarkup(token),/data-song-play/);assert.doesNotMatch(songMarkup(token),/preview/i);assert.equal(matchingSong([song],{title:'Luther',artist:'Kendrick Lamar'}),song);assert.equal(matchingSong([song],{title:'Luther',artist:'Other artist'}),undefined);
assert.equal(catalogSong({...sample,previewUrl:'https://evil.example/test.m4a'}),null);assert.equal(catalogSong({...sample,artworkUrl100:'javascript:alert(1)'}),null);assert.equal(parseSongMessage('[[vela-song:1:not-a-song]]'),null);
assert.ok(songMarkup(createSongMessage({...song,title:'<script>alert(1)</script>',artist:'春 & friends'})).includes('&lt;script&gt;'));assert.equal(parseSongMessage(createSongMessage({...song,title:'春 & friends'})).title,'春 & friends');
console.log('PASS song cards: safe serialization, Unicode, artwork sizing, domain validation, escaped markup and exact track matching');

const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('worker/schema.sql','utf8'));
db.exec("INSERT INTO users(uid,handle,name,created) VALUES('one','one','Alex',0),('two','two','Sam',0),('stranger','stranger','Stranger',0);INSERT INTO friends(id,a,b,requested_by,status,created) VALUES('friend','one','two','one','accepted',0);");
const env={DB:{prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){if(/^\s*SELECT/.test(sql))return statement.all();return {meta:{changes:db.prepare(sql).run(...args).changes}};}};return statement;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}}};
const h={json:data=>data,body:req=>req.json(),fail:(message,status=400)=>{throw Object.assign(Error(message),{status});},rows:async(env,sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results,row:async(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first()};
const request=(uid,method='GET',body,query='')=>listeningHistoryAPI(new Request('https://vela.test/api/listening-history'+query,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})}),env,uid,h);
// node:sqlite treats ?1 as a named binding; translate D1's repeated numbered
// placeholder to anonymous placeholders for this SQLite adapter only.
const originalRows=h.rows;h.rows=(env,sql,...args)=>sql.includes('?1')?originalRows(env,sql.replace(/\?1/g,'?'),...Array.from(sql.matchAll(/\?1/g),()=>args[0])):originalRows(env,sql,...args);
const track={id:crypto.randomUUID(),title:'luther',artist:'Kendrick Lamar',album:'GNX'};
await request('one','POST',{shared:false,track});await request('one','POST',{shared:false,track});assert.equal((await request('one')).items.length,1);assert.equal((await request('two','GET',null,'?scope=friends')).items.length,0);
await request('one','POST',{shared:true});assert.equal((await request('two','GET',null,'?scope=friends')).items.length,1);assert.equal((await request('stranger','GET',null,'?scope=friends')).items.length,0);
db.exec("INSERT INTO blocks(uid,target) VALUES('one','two')");assert.equal((await request('two','GET',null,'?scope=friends')).items.length,0);db.exec('DELETE FROM blocks');
await request('one','POST',{shared:false});assert.equal((await request('two','GET',null,'?scope=friends')).items.length,0);
await request('one','POST',{shared:true,track});assert.equal((await request('one')).sharing,false,'A stale playback heartbeat cannot re-enable sharing');
await assert.rejects(()=>request('one','POST',{shared:true,track:{...track,id:'invalid'}}),/Invalid/);assert.equal((await request('one')).sharing,false,'Invalid activity cannot change privacy preferences');
for(let i=0;i<55;i++)await request('one','POST',{shared:false,track:{...track,id:crypto.randomUUID(),title:'Track '+i}});
let page=await request('one');assert.equal(page.items.length,50);assert.equal(page.more,true);const last=page.items.at(-1);const rest=await request('one','GET',null,'?'+new URLSearchParams({before:String(last.last_seen),cursor:last.id}));assert.equal(new Set([...page.items,...rest.items].map(m=>m.id)).size,56);
db.exec("UPDATE listening_history SET last_seen=0 WHERE uid='one'");assert.equal((await request('one')).items.length,0);
await request('two','POST',{shared:true,track:{...track,id:crypto.randomUUID()}});await request('one','DELETE');assert.equal((await request('two')).items.length,1);await request('two','DELETE');assert.equal((await request('two')).items.length,0);db.close();
console.log('PASS weekly history: idempotent writes, seven-day range, pagination, own history, opt-in friends, strangers excluded, blocked users excluded, immediate sharing revocation and account-scoped clear');

const realNow=Date.now;let now=100000,user='one',writes=[];Date.now=()=>now;
try{
 const tracker=createListeningTracker({self:()=>user,api:async(path,options)=>{writes.push(options.body);return {ok:true};}}),track={title:'Song',artist:'Artist',album:'Album',playing:true};
 await tracker.observe(track,false);now+=9999;await tracker.observe(track,false);assert.equal(writes.length,0);now++;await tracker.observe(track,false);assert.equal(writes.length,1);now+=1000;await tracker.observe(track,false);assert.equal(writes.length,1);now+=60000;await tracker.observe(track,false);assert.equal(writes.length,2);assert.equal(writes[0].track.id,writes[1].track.id);assert.equal(writes[0].shared,false);
 await tracker.observe({...track,playing:false});now+=20000;await tracker.observe(track,false);assert.equal(writes.length,2);user='two';await tracker.observe(track,false);assert.equal(writes.length,2);now+=10000;await tracker.observe(track,false);assert.equal(writes.length,3);assert.notEqual(writes[2].track.id,writes[0].track.id);
}finally{Date.now=realNow;}
console.log('PASS listening tracker: ten-second detection threshold, throttled heartbeats, pause handling, stable play IDs and account isolation');
const failingTracker=createListeningTracker({self:()=> 'one',api:async()=>{throw Error('Offline');}});
await assert.rejects(()=>failingTracker.setSharing(true),/Offline/);assert.equal(failingTracker.shared(),false);
console.log('PASS failed sharing preference saves restore the previous privacy setting');
