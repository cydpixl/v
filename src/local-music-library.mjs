import {desktopTransaction} from './desktop-storage.mjs';
import {assetURL} from './config.js';
import {cleanMusicMetadata,readMusicTags} from './music-metadata.mjs';
let metadataPromise;
export function importedMusicMetadata(){return metadataPromise??=fetch(assetURL('imported-music.json'),{cache:'no-cache'}).then(r=>r.ok?r.json():{tracks:[]}).catch(()=>({tracks:[]}));}
export async function listMusicTracks(owner){
 const [tracks,metadata]=await Promise.all([desktopTransaction('music','readonly',store=>store.index('owner').getAll(owner)),importedMusicMetadata()]);
 return tracks.map(track=>cleanMusicMetadata({...track,...metadata.tracks.find(item=>item.id===track.id)})).sort((a,b)=>(a.index||0)-(b.index||0));
}
// Library reads are entirely local. Opening VELA never fetches song files.
export const importPlaylistOne=owner=>listMusicTracks(owner);
export async function importLocalMusicFiles(owner,files){
 if(!owner)throw Error('Sign in before adding music.');
 const metadata=await importedMusicMetadata();let catalog=[];
 try{const response=await fetch('/local-music/manifest.json',{cache:'no-store'});if(response.ok)catalog=(await response.json()).tracks||[];}catch{}
 const existing=await listMusicTracks(owner),start=existing.reduce((max,t)=>Math.max(max,(t.index||0)+1),0);let added=0;
 for(const file of files){
  if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))continue;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(file.name)),id=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,20);
  const known=metadata.tracks.find(track=>track.id===id)||catalog.find(track=>track.id===id),prior=existing.find(track=>track.id===id),tags=await readMusicTags(file);
  const track=cleanMusicMetadata({...prior,...tags,...known,id,key:owner+':'+id,owner,source:'local',playlist:'playlist-one',fileName:file.name,title:known?.title||tags.title||prior?.title||file.name,artist:known?.artist||tags.artist||prior?.artist||'',album:known?.album||tags.album||prior?.album||'',index:known?.index??prior?.index??start+added,size:file.size,blob:new Blob([file],{type:file.type||'audio/mpeg'}),imported:prior?.imported||Date.now()});
  await desktopTransaction('music','readwrite',store=>store.put(track));added++;
 }
 window.dispatchEvent(new CustomEvent('vela-library-updated',{detail:owner}));return listMusicTracks(owner);
}
