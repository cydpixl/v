import {escape as e} from './util.js';
import './live-music.css';

// Live-music messages are stored as normal authenticated Vela messages with a
// versioned marker. The UI never displays the marker or a music search URL.
const PREFIX='[[vela-live-music:1:';
const pattern=/^\[\[vela-live-music:1:([A-Za-z0-9_-]{8,3000})\]\]$/;
const cache=new Map();
const pending=new Map();
let root=null,reader=null,timer=null,lastConversation='';
const FRESH_MS=60000;
const POLL_MS=11000;

export function createLiveMusicMessage(track){
 const snapshot={
  title:String(track?.title||'').trim().slice(0,200),
  artist:String(track?.artist||'').trim().slice(0,200),
  album:String(track?.album||'').trim().slice(0,200),
  duration:Math.max(0,Math.min(86400000,Number(track?.duration)||0)),
  position:Math.max(0,Number(track?.position)||0),
  playing:track?.playing===true,
  artwork:validCover(track?.artwork)&&track.artwork.length<2100?track.artwork:'',
  at:Date.now()
 };
 if(!snapshot.title)throw Error('Play some music before sharing.');
 let bytes=new TextEncoder().encode(JSON.stringify(snapshot));
 let text=Array.from(bytes,b=>String.fromCharCode(b)).join('');
 let token=PREFIX+btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')+']]';
 if(token.length>2950){snapshot.artwork='';bytes=new TextEncoder().encode(JSON.stringify(snapshot));text=Array.from(bytes,b=>String.fromCharCode(b)).join('');token=PREFIX+btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')+']]';}
 if(token.length>2950)throw Error('Song metadata is too long to share.');
 return token;
}

export function parseLiveMusicMessage(raw){
 const match=typeof raw==='string'&&raw.length<=3000?raw.match(pattern):null;
 if(!match)return null;
 try{
  const b64=match[1].replace(/-/g,'+').replace(/_/g,'/');
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!v||typeof v.title!=='string'||!v.title.trim()||v.title.length>200||typeof v.artist!=='string'||v.artist.length>200||typeof v.album!=='string'||v.album.length>200
    ||typeof v.duration!=='number'||!Number.isFinite(v.duration)||v.duration<0||v.duration>86400000
    ||typeof v.position!=='number'||!Number.isFinite(v.position)||v.position<0
    ||typeof v.at!=='number'||!Number.isFinite(v.at)||typeof v.playing!=='boolean'||(v.artwork!==undefined&&v.artwork!==''&&!validCover(v.artwork)))return null;
  return v;
 }catch{return null}
}
export function isLiveMusicMessage(text){return !!parseLiveMusicMessage(text)}

function stamp(timeMs){
 const seconds=Math.floor(Math.max(0,Number(timeMs)||0)/1000);
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
function validCover(src){
 return typeof src==='string'&&src.length<=40000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(src);
}
function currentPosition(info){
 const duration=Number(info.duration)||0;
 const base=Math.max(0,Number(info.position)||0);
 const elapsed=info.playing===true ? Math.max(0,Date.now()-(Number(info.updated)||Date.now())):0;
 return Math.min(duration||Infinity,base+elapsed);
}

export function liveMusicMarkup(message,owner){
 const snapshot=parseLiveMusicMessage(message);
 if(!snapshot||typeof owner!=='string'||!owner||owner.length>180)return null;
 const encoded=message.slice(PREFIX.length,-2);
 return '<section class="vela-live-music" data-music-owner="'+e(owner)+'" data-music-snapshot="'+encoded+'" role="group" aria-label="Live listening widget">'+
   '<header class="vlm-label"><span class="vlm-indicator"><i></i> LIVE MUSIC</span><span class="vlm-status" data-vlm-status>Connecting</span></header>'+
   '<div class="vlm-body"><div class="vlm-cover" data-vlm-cover><span class="vlm-note" aria-hidden="true" '+(validCover(snapshot.artwork)?'hidden':'')+'>♫</span>'+(validCover(snapshot.artwork)?'<img src="'+e(snapshot.artwork)+'" alt="Album artwork" loading="lazy">':'')+'</div>'+
   '<div class="vlm-details"><strong data-vlm-title title="'+e(snapshot.title)+'">'+e(snapshot.title)+'</strong><span data-vlm-artist>'+e(snapshot.artist||'Unknown artist')+'</span><small data-vlm-album>'+e(snapshot.album||'')+'</small></div>'+
   '<div class="vlm-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>'+
   '<div class="vlm-progress"><div class="vlm-rail"><i data-vlm-bar></i></div><div class="vlm-time"><time data-vlm-elapsed>'+stamp(snapshot.position)+'</time><time data-vlm-duration>'+stamp(snapshot.duration)+'</time></div></div>'+
   '<footer class="vlm-footer" data-vlm-footer>Connecting to live listening activity…</footer></section>';
}
function memoizedSnapshot(node){
 const marker=node.dataset.musicSnapshot;
 if(node.__musicSnapshotMarker===marker)return node.__musicSnapshot;
 node.__musicSnapshotMarker=marker;
 node.__musicSnapshot=parseLiveMusicMessage(PREFIX+marker+']]');
 return node.__musicSnapshot;
}
function set(node,text){if(node&&node.textContent!==text)node.textContent=text;}
function updateWidget(node,entry){
 if(!node.isConnected)return;
 const snapshot=memoizedSnapshot(node);
 if(!snapshot)return;
 const music=entry?.music;
 const freshProfile=!!(music&&Number.isFinite(music.updated)&&Math.abs(Date.now()-music.updated)<FRESH_MS);
 const freshSnapshot=Number.isFinite(snapshot.at)&&Date.now()-snapshot.at<45000&&Date.now()-snapshot.at> -15000;
 const isLive=freshProfile||freshSnapshot;
 const unavailable=entry?.failed;
 const title=node.querySelector('[data-vlm-title]'),artist=node.querySelector('[data-vlm-artist]'),album=node.querySelector('[data-vlm-album]');
 const track=freshProfile?music:snapshot;
 set(title,track.title);if(title)title.title=track.title;
 set(artist,track.artist||'Unknown artist');
 set(album,track.album||'');
 const cover=node.querySelector('[data-vlm-cover]');
 if(cover){
   const image=cover.querySelector('img');
   const artwork=freshProfile&&validCover(music.artwork)?music.artwork:validCover(snapshot.artwork)?snapshot.artwork:'';
   if(artwork){
    if(!image){const img=document.createElement('img');img.alt='Current album artwork';img.loading='lazy';cover.append(img);}
    const img=cover.querySelector('img');
    if(img.getAttribute('src')!==artwork)img.src=artwork;
   }else image?.remove();
 }
 const note=node.querySelector('.vlm-note');if(note)note.hidden=!!cover?.querySelector('img');
 let status,footer;
 if(isLive){
   status=track.playing?'LIVE':'PAUSED';
   footer=track.playing?'Updates as the music changes':'Playback paused';
 }else if(entry){
   status='OFFLINE';
   footer=unavailable?'Unable to reach live status':'Listening activity ended';
 }else{
   status='CONNECTING';
   footer='Connecting to live listening activity…';
 }
 node.classList.toggle('vlm-playing',!!isLive&&track.playing===true);
 node.classList.toggle('vlm-offline',!!entry&&!isLive);
 set(node.querySelector('[data-vlm-status]'),status);
 set(node.querySelector('[data-vlm-footer]'),footer);
 const activeRecord=freshProfile?music:{...snapshot,updated:snapshot.at};
 const pos=isLive?currentPosition(activeRecord):Math.min(snapshot.position,snapshot.duration||Infinity);
 const duration=freshProfile?music.duration:snapshot.duration;
 const pct=duration>0?Math.max(0,Math.min(100,pos/duration*100)):0;
 const bar=node.querySelector('[data-vlm-bar]');
 if(bar)bar.style.width=pct+'%';
 set(node.querySelector('[data-vlm-elapsed]'),stamp(pos));
 set(node.querySelector('[data-vlm-duration]'),stamp(duration));
}
function paint(){
 if(!root?.isConnected||!reader)return;
 root.querySelectorAll('.vela-live-music[data-music-owner]').forEach(node=>{
   updateWidget(node,cache.get(node.dataset.musicOwner));
 });
}
async function fetchOwner(uid){
 if(pending.has(uid)||!reader)return pending.get(uid);
 const currentReader=reader;
 const promise=(async()=>{
   try{
     const response=await currentReader('/profile-extras/'+encodeURIComponent(uid));
     if(reader!==currentReader)return;
     cache.set(uid,{music:response?.profile?.music||null,fetched:Date.now(),failed:false});
   }catch(error){
     if(reader!==currentReader)return;
     cache.set(uid,{music:null,fetched:Date.now(),failed:true});
   }finally{
     pending.delete(uid);
     paint();
   }
 })();
 pending.set(uid,promise);
 return promise;
}
function tick(){
 if(!root?.isConnected||!reader)return;
 const widgets=[...root.querySelectorAll('.vela-live-music[data-music-owner]')];
 if(!widgets.length){stopLiveMusicWidgets();return}
 paint();
 if(document.hidden)return;
 const owners=new Set(widgets.map(node=>node.dataset.musicOwner));
 for(const uid of owners){
   const entry=cache.get(uid);
   if(!entry||Date.now()-entry.fetched>POLL_MS)fetchOwner(uid);
 }
}
export function startLiveMusicWidgets(container,api,conversation){
 if(!container||typeof api!=='function')return;
 const changed=lastConversation!==conversation;
 if(changed){cache.clear();lastConversation=conversation}
 root=container;reader=api;
 if(!container.querySelector('.vela-live-music')){stopLiveMusicWidgets();return}
 if(!timer)timer=setInterval(tick,1000);
 tick();
}
export function stopLiveMusicWidgets(){
 clearInterval(timer);timer=null;root=null;reader=null;lastConversation='';
 cache.clear();pending.clear();
}
export function refreshOwnLiveMusic(uid,music){
 if(typeof uid!=='string'||!uid)return;
 cache.set(uid,{music,fetched:Date.now(),failed:false});
 paint();
}
