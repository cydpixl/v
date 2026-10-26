import assert from 'node:assert/strict';
import {featureAPI} from '../worker/features.js';
import {bodycamItems} from '../src/commands.mjs';
import {canPlayInVela,libraryMovie} from '../src/cinema/library-source.mjs';

const fixtures=[
 {id:'stored',owner:'owner',object_key:'movie/stored',data:JSON.stringify({title:'Stored file',category:'bodycam',channel:'Midwest Safety',playback:'youtube'})},
 {id:'external',owner:'owner',object_key:'',data:JSON.stringify({title:'Direct file',url:'https://connections-catalog.pixlcyd.workers.dev/media.mp4'})},
 {id:'youtube',owner:'owner',object_key:'',data:JSON.stringify({title:'YouTube only',category:'bodycam',channel:'Midwest Safety',playback:'youtube'})},
 {id:'hidden',owner:'owner',object_key:'movie/hidden',data:JSON.stringify({title:'Unlisted file',listed:false})},
];
const env={},h={
 json:data=>data,
 rows:async(_env,query)=>query.includes('FROM movies ORDER BY')?fixtures:[],
 row:async(_env,_query,id)=>fixtures.find(x=>x.id===id),
 issueTicket:async()=> 'test-ticket',
 fail:(message,status)=>{throw Object.assign(Error(message),{status});},
};
const request=(path,method='GET')=>new Request('https://vela.test/api'+path,{method});
const data=await featureAPI(request('/movies'),env,'viewer',h);
assert.deepEqual(data.library.map(x=>x.id),['stored','external']);
assert.equal(data.library[0].playback,'hosted','Real stored files override old YouTube metadata');
assert.ok(!('object_key' in data.library[0]),'Private R2 keys stay on the backend');
assert.deepEqual(bodycamItems(fixtures.map(libraryMovie)).map(x=>x.id),['stored']);
for(const id of ['youtube','hidden']){
 await assert.rejects(()=>featureAPI(request('/movies/'+id+'/play','POST'),env,'viewer',h),e=>e.status===404);
 await assert.rejects(()=>featureAPI(request('/movie-media/'+id),env,'viewer',h),e=>e.status===404);
}
const link=await featureAPI(request('/movies/stored/play','POST'),env,'viewer',h);
assert.ok(link.url.startsWith('https://vela.test/api/movie-media/stored?ticket='));
assert.ok(!link.provider&&!link.videoId);
assert.equal(canPlayInVela(null),false);
console.log('PASS: native-only API catalog, bot collections, stored-file normalization, private key isolation, blocked legacy playback and native media tickets');
