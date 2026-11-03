import {findSongs} from './music-sharing.js';
import {fullSong,localVersion} from './music-metadata.mjs';

export const playableStar='<span class="am-playable-star" role="img" aria-label="Full song available" title="Full song available">★</span>';

export async function renderMusicDiscover({main,query,library,cover,icon,e,live,signal,search,play,options,safe}){
 const words=query.toLowerCase().replace(/ hits$/,'').split(/\s+/).filter(Boolean);
 const available=library.filter(fullSong).filter(t=>words.every(word=>[t.title,t.artist,t.genre,t.originalGenre].join(' ').toLowerCase().includes(word)));
 const featured=available.filter(t=>t.collection).concat(available.filter(t=>!t.collection)).slice(0,12);
 main.innerHTML=`<header class="am-browse-heading"><h1>${query?'Search':'Discover'}</h1><form class="am-browse-search"><input type="search" aria-label="Search catalog" placeholder="Songs, artists, albums" value="${e(query)}"><button type="submit">Search</button></form></header><div class="am-genres">${['For you','Alternative','Pop','Hip-Hop','Rock','R&B','Electronic','Dance'].map(genre=>`<button data-genre="${e(genre)}">${e(genre)}</button>`).join('')}</div><div data-ready-section></div><section class="am-catalog-section"><header class="am-section-heading"><h2>${query?'More music':'Explore more'}</h2><span>Apple Music previews</span></header><p class="am-status" role="status">Loading music…</p><div class="am-album-grid music-browse-results"></div><button class="am-load-more" hidden>More songs</button></section>`;
 main.querySelector('form').onsubmit=event=>{event.preventDefault();search(main.querySelector('input').value.trim())};
 main.querySelectorAll('[data-genre]').forEach(button=>button.onclick=()=>search(button.dataset.genre==='For you'?'':button.dataset.genre+' hits'));
 function card(track,index,kind){const art=cover(track);return `<article class="am-album" data-${kind}-card="${index}"><div class="am-album-art">${art?`<img src="${e(art)}" alt="${e(track.album||track.title)}" loading="lazy">`:`<span class="am-art-placeholder">${icon('music',44)}</span>`}<button data-${kind}-play="${index}" aria-label="Play ${e(track.title)}">${icon('play',24)}</button></div><div class="am-album-title"><span><strong>${fullSong(track)?playableStar:''}${e(track.title)}</strong><small>${e(track.artist)}</small></span><button data-${kind}-options="${index}" aria-label="Options for ${e(track.title)}">${icon('dots',18)}</button></div></article>`}
 function bind(container,tracks,kind){
  container.querySelectorAll(`[data-${kind}-play]`).forEach(button=>button.onclick=()=>safe(()=>play(tracks,Number(button.dataset[kind+'Play']))));
  container.querySelectorAll(`[data-${kind}-options]`).forEach(button=>button.onclick=()=>options(tracks[Number(button.dataset[kind+'Options'])]));
  container.querySelectorAll(`[data-${kind}-card]`).forEach(node=>node.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();options(tracks[Number(node.dataset[kind+'Card'])])});
 }
 if(featured.length){const ready=main.querySelector('[data-ready-section]');ready.innerHTML=`<section class="am-ready-section" aria-label="Ready to play"><header class="am-section-heading"><div><h2>Ready to play</h2><p>${playableStar} Full songs from your library</p></div><button class="am-ready-play" data-play-ready>${icon('play',14)} Play</button></header><div class="am-album-grid">${featured.map((track,index)=>card(track,index,'ready')).join('')}</div></section>`;bind(ready,featured,'ready');ready.querySelector('[data-play-ready]').onclick=()=>safe(()=>play(available));}
 let page=0,catalog=[],loading=false;
 const load=async()=>{if(loading)return;loading=true;const status=main.querySelector('[role=status]');try{
  const terms=query?[query]:['The Weeknd','Sabrina Carpenter','Drake','Billie Eilish'];
  const responses=await Promise.allSettled(terms.map(term=>findSongs(term,{signal,limit:query?40:12,offset:page*(query?40:12)})));
  if(!live())return;const incoming=responses.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
  if(!incoming.length&&responses.every(r=>r.status==='rejected'))throw responses[0].reason;
  // The imported file takes the catalog preview's place as soon as it is added.
  catalog=[...new Map([...catalog,...incoming].map(t=>localVersion(t,library)).map(t=>[t.id,t])).values()];
  const target=main.querySelector('.music-browse-results');target.innerHTML=catalog.map((track,index)=>card(track,index,'catalog')).join('');bind(target,catalog,'catalog');
  status.textContent=catalog.length?'':'No songs found.';main.querySelector('.am-load-more').hidden=!incoming.length;page++;
 }catch(error){if(live()&&error.name!=='AbortError')status.textContent=featured.length?'Catalog previews are unavailable. Your songs are ready to play.':error.message}finally{loading=false}};
 main.querySelector('.am-load-more').onclick=load;await load();
}
