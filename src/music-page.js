import {escape as e} from './util.js';
import {findSongs,enhanceSongCards} from './music-sharing.js';
import {createSongMessage,songMarkup,matchingSong} from './song-model.mjs';

export function createMusicPage({api,self,destinations,activeConversation,send,toast,tracker}){
 let root=null,generation=0,tab='browse',query='',browseQuery='Kendrick Lamar',records=[],before=null,more=false,loading=false,selected='',controller,searchTimer;
 const genres=[['Featured','Kendrick Lamar'],['R&B','SZA'],['Hip-hop','rap'],['Pop','pop'],['Indie','indie alternative'],['Electronic','electronic']];
 function live(epoch){return root?.isConnected&&generation===epoch;}
 function heading(){return `<header class="music-page-header"><div><h1>Music</h1></div><div class="music-page-destination"><label for="music-destination">Send to</label><select id="music-destination" aria-label="Send music to"><option value="">Choose a conversation</option>${destinations().map(c=>`<option value="${e(c.id)}" ${selected===c.id?'selected':''}>${e(c.name)}</option>`).join('')}</select></div></header><nav class="music-page-tabs" aria-label="Music views">${[['browse','Browse'],['mine','This week'],['friends','Friends']].map(([id,label])=>`<button type="button" data-music-view="${id}" aria-pressed="${tab===id}">${label}</button>`).join('')}</nav>`;}
 function render(host){
  controller?.abort();clearTimeout(searchTimer);generation++;root=host;selected=activeConversation()||selected;
  host.className='music-page';host.innerHTML=heading()+'<div class="music-page-body"></div>';
  host.querySelector('#music-destination').onchange=event=>selected=event.target.value;
  host.querySelectorAll('[data-music-view]').forEach(button=>button.onclick=()=>{tab=button.dataset.musicView;host.querySelectorAll('[data-music-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.musicView===tab)));show();});show();
 }
 function musicRows(songs){return songs.map(song=>`<article class="music-browse-track"><div>${songMarkup(createSongMessage(song))}</div><button type="button" class="primary" data-page-send="${e(song.id)}" aria-label="Send ${e(song.title)}">Send</button></article>`).join('');}
 function wireSend(songs){
  enhanceSongCards(root);
  root.querySelectorAll('[data-page-send]').forEach(button=>button.onclick=async()=>{
   if(!selected){root.querySelector('#music-destination').focus();toast('Choose a conversation.');return;}
   const owner=self(),cid=selected;button.disabled=true;button.textContent='Sending…';
   try{await send(songs.find(song=>song.id===button.dataset.pageSend),cid,owner);button.textContent='Sent';setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent='Send';}},1600);}catch(error){button.disabled=false;button.textContent='Send';toast(error.message);}
  });
 }
 function show(){
  controller?.abort();clearTimeout(searchTimer);generation++;before=null;records=[];loading=false;
  const body=root.querySelector('.music-page-body');for(const audio of body.querySelectorAll('audio'))audio.pause();
  if(tab==='browse'){
   body.innerHTML=`<form class="music-page-search"><input type="search" aria-label="Search music" placeholder="Search songs or artists" value="${e(query)}"><button class="secondary" type="submit">Search</button></form><nav class="music-genres" aria-label="Browse music">${genres.map(([name,term])=>`<button type="button" data-music-genre="${e(term)}" aria-pressed="${browseQuery===term&&!query}">${e(name)}</button>`).join('')}</nav><h2 data-music-section>${query?'Search results':'Browse'}</h2><p role="status" data-music-status></p><div class="music-browse-results"></div><button class="secondary" data-music-retry hidden>Try again</button>`;
   const input=body.querySelector('input');
   const run=()=>{query=input.value.trim();body.querySelector('[data-music-section]').textContent=query?'Search results':'Browse';catalog(query||browseQuery);};
   body.querySelector('form').onsubmit=event=>{event.preventDefault();clearTimeout(searchTimer);run();};input.oninput=()=>{clearTimeout(searchTimer);controller?.abort();generation++;searchTimer=setTimeout(()=>{if(body.isConnected&&tab==='browse')run();},650);};
   body.querySelectorAll('[data-music-genre]').forEach(button=>button.onclick=()=>{clearTimeout(searchTimer);browseQuery=button.dataset.musicGenre;input.value='';query='';body.querySelectorAll('[data-music-genre]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));run();});body.querySelector('[data-music-retry]').onclick=run;catalog(query||browseQuery);
  }else{
   body.innerHTML=`<div class="music-week-heading"><h2>${tab==='mine'?'Your week':'Friends this week'}</h2><span>Last 7 days</span></div>${tab==='mine'?'<div class="music-history-options"><label><input type="checkbox" data-share-week> Share listening history with friends</label><button type="button" class="text-button" data-clear-history>Clear history</button></div>':''}<p role="status" data-music-status></p><div class="music-history-results"></div><button class="secondary" data-history-more hidden>Load more</button><button class="secondary" data-history-retry hidden>Try again</button>`;
   body.querySelector('[data-history-more]').onclick=()=>history(true);body.querySelector('[data-history-retry]').onclick=()=>history(false);
   body.querySelector('[data-share-week]')?.addEventListener('change',async event=>{const input=event.target;input.disabled=true;try{await tracker.setSharing(input.checked);window.velaSMTC?.setSharing?.(input.checked);}catch(error){input.checked=!input.checked;toast(error.message);}finally{input.disabled=false;}});
   body.querySelector('[data-clear-history]')?.addEventListener('click',async()=>{try{await api('/listening-history',{method:'DELETE'});tracker.reset();history();}catch(error){toast(error.message);}});
   history();
  }
 }
 async function catalog(term){
  controller?.abort();const epoch=++generation;controller=new AbortController();const status=root.querySelector('[data-music-status]'),results=root.querySelector('.music-browse-results'),retry=root.querySelector('[data-music-retry]');status.textContent='Loading…';retry.hidden=true;for(const audio of results.querySelectorAll('audio'))audio.pause();results.replaceChildren();results.setAttribute('aria-busy','true');
  try{const songs=await findSongs(term,{signal:controller.signal});if(!live(epoch))return;for(const audio of results.querySelectorAll('audio'))audio.pause();results.innerHTML=musicRows(songs);status.textContent=songs.length?'':'No songs found.';wireSend(songs);}catch(error){if(live(epoch)&&error.name!=='AbortError'){status.textContent=error.message;retry.hidden=false;}}finally{if(live(epoch))results.setAttribute('aria-busy','false');}
 }
 async function history(append=false){
  if(loading)return;loading=true;const epoch=generation,owner=self(),status=root.querySelector('[data-music-status]'),results=root.querySelector('.music-history-results'),moreButton=root.querySelector('[data-history-more]');
  status.textContent='Loading…';moreButton.disabled=true;root.querySelector('[data-history-retry]').hidden=true;
  try{
   const data=await api('/listening-history?'+new URLSearchParams({scope:tab,...(append&&before?before:{})}));if(!live(epoch)||self()!==owner)return;
   records=append?[...records,...data.items]:data.items;more=data.more;const last=records.at(-1);before=last?{before:String(last.last_seen),cursor:last.id}:null;
   const share=root.querySelector('[data-share-week]');if(share)share.checked=data.sharing;
   const seen=new Set();records=records.filter(item=>{const key=item.uid+':'+item.id;if(seen.has(key))return false;seen.add(key);return true;});
   results.innerHTML=records.map((item,index)=>`<article class="music-history-row"><div class="history-person">${item.avatar?`<img src="${e(/^https:\/\//.test(item.avatar)?item.avatar:'')}" alt="">`:'<span>♫</span>'}<span><strong>${e(item.name)}</strong><time>${e(new Date(item.last_seen).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}))}</time></span></div><div class="history-song"><strong>${e(item.title)}</strong><span>${e(item.artist)}</span></div><button type="button" class="secondary" data-find-history="${index}">Send</button></article>`).join('');
   status.textContent=records.length?'':tab==='mine'?'No listening activity yet. Detected songs appear here as you listen.':'No shared listening activity this week.';moreButton.hidden=!more;
   results.querySelectorAll('[data-find-history]').forEach(button=>button.onclick=async()=>{
    if(!selected){root.querySelector('#music-destination').focus();toast('Choose a conversation.');return;}
    const item=records[Number(button.dataset.findHistory)],owner=self(),cid=selected;button.disabled=true;button.textContent='Sending…';
    try{const songs=await findSongs([item.title,item.artist].filter(Boolean).join(' '));if(!live(epoch)||self()!==owner)return;const song=matchingSong(songs,item);if(!song){query=[item.title,item.artist].filter(Boolean).join(' ');tab='browse';root.querySelectorAll('[data-music-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.musicView===tab)));show();toast('Choose the song version to send.');return;}await send(song,cid,owner);button.textContent='Sent';}catch(error){toast(error.message);}finally{if(button.isConnected){button.disabled=false;if(button.textContent!=='Sent')button.textContent='Send';}}
   });
  }catch(error){if(live(epoch)){status.textContent='Listening history could not load. '+error.message;root.querySelector('[data-history-retry]').hidden=false;}}
  finally{if(live(epoch)){loading=false;moreButton.disabled=false;}}
 }
 return {render};
}
