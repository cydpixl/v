import {desktopPlayerState,playDesktopTracks,seekDesktopPlayer,toggleDesktopPlayer} from './desktop-player.js';
let runtime,following=null,followingEpoch=0,busy=false,lastSignature='',lastPublished=0,lastOwner=null;
export const desktopMusicPlaying=()=>desktopPlayerState().playing;
export const musicFollowing=()=>following;
export const musicSharingEnabled=()=>localStorage.getItem('desktop.music.share.'+runtime?.self())!=='off';
export async function setMusicSharing(value){localStorage.setItem('desktop.music.share.'+runtime.self(),value?'on':'off');lastSignature='pending';lastPublished=0;await publish();}
export function stopMusicFollowing(){followingEpoch++;following=null;window.dispatchEvent(new Event('vela-music-following'));}
export function configureMusicPresence(options){
 runtime=options;
 window.addEventListener('vela-player-state',()=>publish().catch(()=>{}));
 setInterval(()=>{publish().catch(()=>{});if(following)sync().catch(error=>{stopMusicFollowing();runtime.toast(error.message)})},5000);
}
async function publish(){
 const uid=runtime?.self();if(!uid||busy)return;
 if(lastOwner!==uid){lastOwner=uid;lastSignature='';lastPublished=0;stopMusicFollowing()}
 const state=desktopPlayerState(),track=state.track;
 runtime.tracker.observe(track?{...track,playing:state.playing,source:'library-player'}:null);
 const music=track&&state.playing&&musicSharingEnabled()?{title:track.title,artist:track.artist||'',album:track.album||'',source:track.playlist==='playlist-one'?'Playlist One':'Music',playing:true,position:state.position*1000,duration:state.duration*1000,artwork:''}:null;
 const signature=music?music.title+'\0'+music.artist:'paused';
 if(signature===lastSignature&&Date.now()-lastPublished<15000)return;
 // Avoid erasing an unrelated system music status before desktop playback starts.
 if(!music&&!lastSignature)return;
 busy=true;
 try{await runtime.api('/profile-extras/'+encodeURIComponent(uid),{method:'PUT',body:{music}});if(runtime.self()===uid){lastPublished=Date.now();lastSignature=signature;runtime.publishLocal(music?{...music,updated:Date.now()}:null)}}finally{busy=false}
}
export async function followMusic(person){lastOwner=runtime.self();following={uid:person.uid,name:person.name,owner:runtime.self()};followingEpoch++;await sync();window.dispatchEvent(new Event('vela-music-following'));}
let syncing=false;
async function sync(){
 if(syncing||!following)return;syncing=true;const epoch=followingEpoch,person=following;
 try{
  if(runtime.self()!==person.owner){stopMusicFollowing();return}
  const {items}=await runtime.api('/music-listening');if(epoch!==followingEpoch)return;
  const live=items.find(item=>item.uid===person.uid);if(!live){stopMusicFollowing();runtime.toast(person.name+' stopped sharing music.');return}
  if(!live.music.trackId)throw Error('This song is not in the shared library. Add your own copy to listen.');
  let state=desktopPlayerState();
  if(state.track?.id!==live.music.trackId){const library=await runtime.api('/music-library');if(epoch!==followingEpoch)return;const index=library.items.findIndex(track=>track.id===live.music.trackId);if(index<0)throw Error('Song is unavailable.');await playDesktopTracks(library.items,index);if(epoch!==followingEpoch)return;state=desktopPlayerState()}
  const target=Math.min(state.duration,(live.music.position+Date.now()-live.music.updated)/1000);
  if(state.duration&&Math.abs(state.position-target)>2)seekDesktopPlayer(target/state.duration);
  if(!state.playing)await toggleDesktopPlayer();
 }finally{syncing=false}
}
