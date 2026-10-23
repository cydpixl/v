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
