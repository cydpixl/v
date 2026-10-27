import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// These checks deliberately load the pure widget logic without DOM/CSS imports;
// Vite's real build covers the CSS/module integration.
let code=readFileSync(new URL('../src/live-music.js',import.meta.url),'utf8')
 .replace(/^import \{escape as e\} from '\.\/util\.js';\r?\n/m,'')
 .replace(/^import '\.\/live-music\.css';\r?\n/m,'');
if(code.includes("import './live-music.css'"))throw Error('Unexpected module import');
code='const e=value=>String(value??"").replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;","\'":"&#39;"}[c]));\n'+code;
const source='data:text/javascript;base64,'+Buffer.from(code,'utf8').toString('base64');
const {createLiveMusicMessage,parseLiveMusicMessage,liveMusicMarkup,isLiveMusicMessage}=await import(source);
const example={title:'Ça Va — 春',artist:'Artist & Friends <live>',album:'Blue "Nights"',duration:212000,position:35000,playing:true};
const encoded=createLiveMusicMessage(example);
assert.match(encoded,/^\[\[vela-live-music:1:[A-Za-z0-9_-]+\]\]$/);
assert.ok(encoded.length<2500);
const info=parseLiveMusicMessage(encoded);
assert.equal(info.title,example.title);
assert.equal(info.artist,example.artist);
assert.equal(info.playing,true);
assert.equal(info.position,35000);
assert.equal(info.duration,212000);
assert.equal(isLiveMusicMessage(encoded),true);
assert.equal(isLiveMusicMessage('♫ Now playing: Song https://music.apple.com'),false);
assert.equal(parseLiveMusicMessage('[[vela-live-music:1:THIS_IS_NOT_JSON]]'),null);
const html=liveMusicMarkup(encoded,'firebase-user-id');
assert.ok(html.includes('class="vela-live-music"'));
assert.ok(html.includes('data-music-owner="firebase-user-id"'));
assert.ok(html.includes('LIVE MUSIC'));
assert.ok(html.includes('Artist &amp; Friends &lt;live&gt;'));
assert.ok(!html.includes('https://music.apple.com'));
assert.ok(!html.includes('[[vela-live-music'));
assert.equal(liveMusicMarkup('plain text','firebase-user-id'),null);
assert.equal(liveMusicMarkup(encoded,''),null);
const malicious=liveMusicMarkup(encoded,'bad" onclick="alert(1)');
assert.ok(malicious.includes('&quot;'));
assert.ok(!malicious.includes('data-music-owner="bad" onclick='));
console.log('Live music widget tests passed (token, Unicode, validity, escaped HTML and no links).');
