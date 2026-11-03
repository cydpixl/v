import fs from 'node:fs/promises';
const folder='public/app-icons';await fs.mkdir(folder,{recursive:true});
const sources={store:'https://upload.wikimedia.org/wikipedia/commons/6/67/App_Store_%28iOS%29.svg',music:'https://upload.wikimedia.org/wikipedia/commons/5/5f/Apple_Music_icon.svg'};
// Resolve the artwork from Apple's own catalog rather than approximating app icons.
for(const [name,id] of Object.entries({music:1108187390,notepad:1110145109,files:1232058109,calculator:1069511488})){try{const data=await(await fetch('https://itunes.apple.com/lookup?id='+id)).json();const app=data.results?.[0];if(app?.artworkUrl512){const url=app.artworkUrl512,response=await fetch(url);if(response.ok){await fs.writeFile(folder+'/'+name+'.png',Buffer.from(await response.arrayBuffer()));console.log(name,app.trackName);}}}catch(error){console.log(name,error.message)}}
const response=await fetch(sources.store);if(!response.ok)throw Error('App Store icon download failed');await fs.writeFile(folder+'/store.svg',await response.text());
await fs.writeFile(folder+'/SOURCES.md','App icons downloaded from Apple catalog artwork via https://itunes.apple.com/lookup and the iOS App Store logo from https://commons.wikimedia.org/wiki/File:App_Store_(iOS).svg. Apple owns the marks. VELA Chat and Flick retain their own identities.\n');
