import assert from 'node:assert/strict';
import {selectLibrary,renderLibrary,isContinuing,isWatched} from '../src/cinema/library.mjs';

const media=[
 {id:'a',title:'A film',kind:'movie',year:'2021'},
 {id:'e2',title:'Episode 2',showTitle:'A show',kind:'tv',season:1,episode:2},
 {id:'e1',title:'Episode 1',showTitle:'A show',kind:'tv',season:1,episode:1},
 {id:'b',title:'B film',kind:'movie',year:'2024'},
];
const progress={e1:{position:120,duration:1200,at:100},e2:{position:400,duration:1200,at:200},b:{position:1190,duration:1200,at:300}};
assert.equal(selectLibrary(media,progress).length,3,'Series group into a single title');
assert.equal(selectLibrary(media,progress).find(x=>x.kind==='tv').id,'e2','Keep newest uploaded episode when grouping');
assert.deepEqual(selectLibrary(media,progress,{filter:'continue'}).map(x=>x.id),['e2','e1'],'Progress preserves episodes and latest viewing order');
assert.deepEqual(selectLibrary(media,progress,{filter:'watched'}).map(x=>x.id),['b']);
assert.deepEqual(selectLibrary(media,progress,{query:'a SHOW'}).map(x=>x.id),['e2']);
assert.deepEqual(selectLibrary(media,progress,{filter:'movies',sort:'year'}).map(x=>x.id),['b','a']);
assert.deepEqual(selectLibrary(media,progress,{filter:'movies',sort:'title'}).map(x=>x.id),['a','b']);
assert.ok(isContinuing(progress.e1));assert.ok(isWatched(progress.b));
assert.ok(!isContinuing(undefined));assert.ok(!isWatched(undefined));
assert.ok(renderLibrary([],{}).includes('data-trigger-upload'));
assert.ok(renderLibrary(media,progress,{query:'<script>'}).includes('&lt;script&gt;'));
assert.ok(!renderLibrary(media,progress,{query:'<script>'}).includes('value="<script>"'));
assert.deepEqual(media.map(x=>x.id),['a','e2','e1','b'],'Filtering must not reorder source state');
console.log('PASS: library grouping, resume order, watched state, search, sort, escaping, empty state and source isolation');
const bodycam={id:'bc',title:'Police investigation',kind:'movie',category:'bodycam',channel:'EWU Crime Storytime',duration:2691,height:1080,poster:'https://cydpixl.github.io/v/media/bodycam/LovV99dWUmk.jpg'};
assert.deepEqual(selectLibrary([...media,bodycam],{}, {filter:'bodycam'}).map(x=>x.id),['bc']);
assert.deepEqual(selectLibrary([bodycam],{}, {query:'EWU bodycam'}).map(x=>x.id),['bc']);
const collection=renderLibrary([bodycam],{},{filter:'bodycam'});
assert.ok(collection.includes('data-library-filter="bodycam" aria-pressed="true"'));
assert.ok(collection.includes('<img src="'+bodycam.poster+'"'));
assert.ok(collection.includes('EWU Crime Storytime · 45 min · 1080p'));
assert.ok(!renderLibrary([{...bodycam,poster:'https://untrusted.example/track.jpg'}],{}).includes('https://untrusted.example'));
console.log('PASS: bodycam filtering, channel search, original thumbnail allowlist and actual media metadata');
const daily={id:'daily',title:'One In A Million Throw',kind:'movie',category:'daily-dose',channel:'Daily Dose Of Internet',duration:902,playback:'hosted',height:1080,poster:'https://cydpixl.github.io/v/media/youtube/1BPVIOqMeac.jpg'};
assert.deepEqual(selectLibrary([bodycam,daily],{},{filter:'daily-dose'}).map(x=>x.id),['daily']);
const dailyHTML=renderLibrary([bodycam,daily],{},{filter:'daily-dose'});
assert.ok(dailyHTML.includes('Daily Dose of Internet'));
assert.ok(dailyHTML.includes('Daily Dose Of Internet · 16 min · 1080p'));
assert.ok(dailyHTML.includes('cinema-landscape')&&dailyHTML.includes(daily.poster));
assert.equal(selectLibrary([{...daily,playback:'youtube'}],{}).length,0);
assert.ok(!renderLibrary([{...daily,playback:'youtube'}],{}).includes('data-play-id'));
assert.equal(selectLibrary([{...daily,listed:false}],{}).length,0);
assert.ok(!renderLibrary([{...daily,poster:'https://cydpixl.github.io/v/media/youtube/../../track.jpg'}],{}).includes('track.jpg'));
console.log('PASS: Daily Dose category, native playback and unavailable-video exclusion and thumbnail allowlist');
