import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {PLANS} from '../src/virtual-internet.mjs';

const here=new URL('../',import.meta.url),source=path=>readFileSync(new URL(path,here),'utf8');
const gamesDir=new URL('public/open-games/',here);
const games=readdirSync(gamesDir,{withFileTypes:true}).filter(x=>x.isDirectory()&&existsSync(new URL(x.name+'/index.html',gamesDir))).map(x=>x.name);
assert.equal(games.length,50,'Exactly 50 playable open-source HTML games must ship');
for(const slug of games){
 const html=readFileSync(new URL(slug+'/index.html',gamesDir),'utf8');
 assert.match(html,/<html[\s>]/i,'Game '+slug+' must be an HTML document');
 assert.ok(html.length>1000,'Game '+slug+' must have actual source code');
}
assert.ok(existsSync(new URL('LICENSE-MASHUKUI.txt',gamesDir)));
assert.ok(existsSync(new URL('LICENSE-ARCADIA.txt',gamesDir)));
const best=PLANS.find(x=>x.id==='5gig');
assert.equal(best.down,5000);
assert.equal(best.price,300);
const required=['src/spectrum-app.mjs','src/live-studio.mjs','src/utility-suite.mjs','src/desktop-catalog.js','src/app-installs.mjs','src/hub.js','src/app-store.js','src/chat-backgrounds.mjs'];
for(const path of required)assert.ok(existsSync(new URL(path,here)),path+' must be included');
const catalog=source('src/desktop-catalog.js'),hub=source('src/hub.js'),installs=source('src/app-installs.mjs'),dateArt=source('src/store-art.js'),youtube=source('src/youtube-app.mjs'),chat=source('src/app.js'),suite=source('src/utility-suite.mjs');
for(const key of ['spectrum','live-studio','UTILITY_APPS','OPEN_GAMES'])assert.ok(catalog.includes(key),'Desktop catalog must include '+key);
for(const key of ['mountSpectrum','mountLiveStudio','mountUtilityApp','mountOpenGame'])assert.ok(hub.includes(key),'Desktop router must include '+key);
assert.ok(installs.includes('simulatedMbps(owner)'));
assert.ok(installs.includes('speed>=5000?0'));
assert.ok(dateArt.includes('ms-cover-date'),'Date artwork should be specific to Date');
assert.ok(youtube.includes('signal:uploadController.signal'),'YouTube transcode should use the actual abort signal');
assert.ok(youtube.includes('transferFile=convertedUpload||draft.file'),'Native MP4 upload must not require a transcode');
assert.ok(chat.includes('chooseChatBackground'),'Chat backgrounds must be selectable');
assert.equal((suite.match(/\['[^']+','[^']+','[^']+','[^']+','[^']+'\]/g)||[]).length,26,'26 working utility app definitions');
console.log('Vela desktop release static checks passed: 50 games, 26 utilities, Spectrum, Studio, chat and upload integration.');
