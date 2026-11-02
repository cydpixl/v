import {desktopTransaction} from './desktop-storage.mjs';
export const listMusicTracks=async owner=>(await desktopTransaction('music','readonly',store=>store.index('owner').getAll(owner))).sort((a,b)=>a.index-b.index);
// Library reads are entirely local. Opening VELA never fetches song files.
export const importPlaylistOne=owner=>listMusicTracks(owner);
export async function importLocalMusicFiles(owner,files){
 let catalog=[];try{const response=await fetch('/local-music/manifest.json',{cache:'no-store'});if(response.ok)catalog=(await response.json()).tracks||[];}catch{}
 const tracks=[];for(const file of files){if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))continue;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(file.name)),id=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,20),known=catalog.find(track=>track.id===id);let cover=null;if(known?.artwork){try{const response=await fetch(known.artwork);if(response.ok)cover=await response.blob()}catch{}}const track={...(known||{}),id,key:owner+':'+id,owner,playlist:'playlist-one',title:known?.title||file.name.replace(/\.[^.]+$/,''),artist:known?.artist||'Local music',album:known?.album||'',index:known?.index??tracks.length,size:file.size,blob:new Blob([file],{type:file.type||'audio/mpeg'}),cover,imported:Date.now()};await desktopTransaction('music','readwrite',store=>store.put(track));tracks.push(track);}window.dispatchEvent(new CustomEvent('vela-library-updated',{detail:owner}));return listMusicTracks(owner);
}
