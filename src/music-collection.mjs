import {groupMusicGenres} from './music-metadata.mjs';
// Account playlists are private by default. Retry imports without duplicating tracks.
export async function organizeMusicCollection(api,owner,tracks,metadata,onProgress=()=>{}){
 const request=async(path,options)=>{for(let attempt=0;;attempt++){try{return await api(path,options)}catch(error){if(attempt>=4||!(/too many requests|429/i.test(error.message)||error.status===429))throw error;onProgress('Organizing playlists — waiting for the library…');await new Promise(resolve=>setTimeout(resolve,15000))}}};
 const imported=tracks.filter(track=>track.collection===metadata.id&&track.blob?.size);
 if(!imported.length)return;
 const existing=(await api('/music-playlists')).items;
 const groups=[[metadata.name,imported],...groupMusicGenres(imported).map(([genre,songs])=>[genre,songs])];
 for(const [name,songs]of groups){
  onProgress('Organizing '+name+'…');
  let playlist=existing.find(p=>p.owner===owner&&p.name===name);
  playlist=playlist?await api('/music-playlists/'+playlist.id):await api('/music-playlists',{method:'POST',body:{name,description:name===metadata.name?'Ashlan and Jaymes’s collection.':'From Ashlan and Jaymes’s collection.',members:[]}});
  const saved=new Set(playlist.tracks.filter(t=>t.source==='local').map(t=>t.id));
  for(const track of songs){if(saved.has(track.id))continue;await request('/music-playlists/'+playlist.id+'/tracks',{method:'POST',body:{track:{source:'local',id:track.id,title:track.title,artist:track.artist,album:track.album,duration:track.duration}}});saved.add(track.id);onProgress(name+' · '+saved.size+' / '+songs.length);await new Promise(resolve=>setTimeout(resolve,800))}
 }
}
