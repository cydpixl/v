import {escape as e} from './util.js';
import {catalogSong,createSongMessage,songMarkup,matchingSong,parseSongMessage,playIcon,pauseIcon} from './song-model.mjs';
import './music-sharing.css';

const catalogCache=new Map(),wired=new WeakSet(),players=new Set();
const time=seconds=>Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'):'—';
export async function findSongs(query,{signal,limit=40,offset=0}={}){
 const key=String(query).trim().slice(0,240);
 if(!key)return [];
 if(/^https?:/i.test(key))throw Error('Search by song title or artist.');
 const existing=catalogCache.get(key+':'+offset+':'+limit);if(existing&&Date.now()-existing.at<1800000)return existing.songs;
 const url='https://itunes.apple.com/search?'+new URLSearchParams({term:key,entity:'song',media:'music',limit:String(limit),offset:String(offset),country:'us'});
 const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error(response.status===429?'Music search is busy. Try again shortly.':'Music could not load. Try again.');
 const data=await response.json(),songs=[...new Map((data.results||[]).map(catalogSong).filter(Boolean).map(song=>[song.id,song])).values()];
 if(catalogCache.size>=50)catalogCache.delete(catalogCache.keys().next().value);catalogCache.set(key+':'+offset+':'+limit,{songs,at:Date.now()});return songs;
}

export function enhanceSongCards(root=document){
 for(const card of root.querySelectorAll('.song-card')){
  if(wired.has(card))continue;wired.add(card);players.add(card);
  const audio=card.querySelector('audio'),button=card.querySelector('[data-song-play]'),seek=card.querySelector('[data-song-seek]'),error=card.querySelector('.song-error');
  const title=card.querySelector('.song-card-details strong').textContent;
  function paint(){
   const playing=!audio.paused&&!audio.ended;button.innerHTML=playing?pauseIcon:playIcon;button.setAttribute('aria-label',(playing?'Pause ':'Play ')+title);button.setAttribute('aria-pressed',String(playing));card.classList.toggle('is-playing',playing);
   const song=parseSongMessage(card.dataset.songToken);if(song)window.velaMusic?.observeListening?.({...song,playing,source:'vela-card'});
   const duration=audio.duration;seek.disabled=!Number.isFinite(duration)||duration<=0;seek.value=seek.disabled?'0':String(Math.round(audio.currentTime/duration*1000));seek.setAttribute('aria-valuetext',time(audio.currentTime)+' of '+time(duration));
   card.querySelector('[data-song-elapsed]').textContent=time(audio.currentTime);card.querySelector('[data-song-duration]').textContent=time(duration);seek.style.setProperty('--song-progress',seek.value/10+'%');
  }
  function failure(){error.hidden=false;error.textContent='This song could not play. Try again or open it in Apple Music.';paint();}
  button.onclick=async()=>{error.hidden=true;if(!audio.paused){audio.pause();return;}button.disabled=true;try{for(const other of document.querySelectorAll('.song-card audio'))if(other!==audio)other.pause();if(!audio.getAttribute('src'))audio.src=audio.dataset.songSrc;if(audio.error)audio.load();await audio.play();}catch{failure();}finally{button.disabled=false;paint();}};
  seek.oninput=()=>{if(Number.isFinite(audio.duration)){audio.currentTime=Number(seek.value)/1000*audio.duration;paint();}};
  for(const event of ['play','pause','ended','timeupdate','loadedmetadata','durationchange'])audio.addEventListener(event,paint);audio.addEventListener('error',failure);paint();
 }
}

export function createMusicSharing({modal,toast,send,self,conversation,sendLive}){
 let panel=null,observerFrame;
 const observer=new MutationObserver(()=>{if(observerFrame)return;observerFrame=requestAnimationFrame(()=>{observerFrame=0;for(const card of players)if(!card.isConnected){card.querySelector('audio')?.pause();players.delete(card);}enhanceSongCards();});});
 observer.observe(document.body,{childList:true,subtree:true});
 function open(initial=''){
  if(panel?.isConnected){panel.querySelector('[data-song-query]').focus();return panel;}
  const owner=self(),cid=conversation();if(!owner||!cid){toast('Open a conversation to send music.');return;}
  let controller,timer,epoch=0,busy=false,lastQuery='';
  panel=modal('Music',`<form class="music-search-form"><label for="song-query">Find a song</label><div><input id="song-query" data-song-query type="search" autocomplete="off" placeholder="Search songs or artists" aria-label="Find a song" value="${e(initial)}"><button type="submit" class="secondary">Search</button></div></form><div class="music-now-playing" hidden></div><p class="music-search-status" role="status">Search songs or artists.</p><div class="music-search-results"></div><button class="secondary" data-song-retry hidden>Try again</button>`,{onclose:()=>{epoch++;controller?.abort();clearTimeout(timer);for(const audio of panel?.querySelectorAll('audio')||[])audio.pause();panel=null;}});
  const dialog=panel;dialog.classList.add('music-share-dialog');
  const query=dialog.querySelector('[data-song-query]'),results=dialog.querySelector('.music-search-results'),status=dialog.querySelector('.music-search-status'),retry=dialog.querySelector('[data-song-retry]');
  const current=id=>dialog.open&&id===epoch&&self()===owner&&conversation()===cid;
  const track=window.velaSMTC?.track?.();
  if(track?.title){const now=dialog.querySelector('.music-now-playing');now.hidden=false;now.innerHTML=`<span>Now playing <strong>${e(track.title)}</strong><small>${e(track.artist)}</small></span><button type="button" class="secondary" data-find-current>Find song</button><button type="button" class="text-button" data-share-live>Share live activity</button>`;now.querySelector('[data-find-current]').onclick=()=>{query.value=[track.title,track.artist].filter(Boolean).join(' ');search();};now.querySelector('[data-share-live]').onclick=async event=>{event.target.disabled=true;try{if(!current(epoch))throw Error('Your conversation changed.');await sendLive(await window.velaSMTC.snapshot());dialog.close();toast('Music shared.');}catch(error){event.target.disabled=false;status.textContent=error.message;}};}
  async function search(){
   clearTimeout(timer);controller?.abort();const id=++epoch;controller=new AbortController();const value=query.value.trim();lastQuery=value;retry.hidden=true;
   for(const audio of results.querySelectorAll('audio'))audio.pause();results.replaceChildren();
   if(!value){status.textContent='Search songs or artists.';return;}
   status.textContent='Finding music…';results.setAttribute('aria-busy','true');
   try{
    const songs=await findSongs(value,{signal:controller.signal});if(!current(id))return;
    status.textContent=songs.length?`${songs.length} song${songs.length===1?'':'s'}`:'No songs found. Try the song title and artist.';
    results.innerHTML=songs.map(song=>`<article class="music-search-row"><div class="music-result-player">${songMarkup(createSongMessage(song))}</div><button type="button" class="primary" data-send-song="${e(song.id)}" aria-label="Send ${e(song.title)}">Send</button></article>`).join('');enhanceSongCards(results);
    for(const button of results.querySelectorAll('[data-send-song]'))button.onclick=async()=>{
     if(busy)return;if(!current(id)){status.textContent='Your conversation changed. Open Music in the current chat.';return;}
     busy=true;button.disabled=true;button.textContent='Sending…';
     try{await send(songs.find(song=>song.id===button.dataset.sendSong),cid,owner);dialog.close();toast('Song sent.');}catch(error){status.textContent=error.message;button.disabled=false;button.textContent='Send';}finally{busy=false;}
    };
   }catch(error){if(current(id)&&error.name!=='AbortError'){status.textContent=error.message;retry.hidden=false;}}finally{if(current(id))results.setAttribute('aria-busy','false');}
  }
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();search();};retry.onclick=search;
  query.oninput=()=>{if(query.value.trim()===lastQuery)return;epoch++;controller?.abort();clearTimeout(timer);retry.hidden=true;results.replaceChildren();status.textContent=query.value.trim()?'Finding music…':'Search songs or artists.';timer=setTimeout(search,650);};
  if(initial)search();query.focus();return dialog;
 }
 async function sendCurrent(track){
  const owner=self(),cid=conversation();if(!owner||!cid)throw Error('Open a conversation to send music.');
  const songs=await findSongs([track.title,track.artist].filter(Boolean).join(' '));
  const song=matchingSong(songs,track);
  if(!song){open([track.title,track.artist].filter(Boolean).join(' '));return false;}
  if(self()!==owner||conversation()!==cid)throw Error('Your conversation changed. Send the song again.');
  await send(song,cid,owner);return true;
 }
 return {open,sendCurrent,reset(){panel?.close();for(const audio of document.querySelectorAll('.song-card audio'))audio.pause();}};
}
