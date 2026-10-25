import {movieTile} from './movie-browser.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isContinuing=p=>Number(p?.position)>10&&Number(p?.duration)>Number(p.position)+30;
export const isWatched=p=>typeof p?.watched==='boolean'?p.watched:Number(p?.duration)>0&&Number(p?.position)>=Number(p.duration)-30;

export function selectLibrary(library,progress,{query='',filter='all',sort='recent',playback='all'}={}){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 let items=library.filter(item=>words.every(word=>[item.title,item.showTitle,item.episodeTitle,item.year,item.channel,item.category].filter(Boolean).join(' ').toLocaleLowerCase().includes(word)));
 if(playback==='direct')items=items.filter(item=>item.playback!=='youtube');else if(playback==='youtube')items=items.filter(item=>item.playback==='youtube');
 if(['bodycam','daily-dose'].includes(filter))items=items.filter(item=>item.category===filter);
 items=items.filter(item=>filter==='music'?item.kind==='song':filter==='movies'?item.kind!=='tv'&&item.kind!=='song':filter==='tv'?item.kind==='tv':filter==='continue'?isContinuing(progress[item.id]):filter==='watched'?isWatched(progress[item.id]):true);
 if(filter==='continue')items.sort((a,b)=>(progress[b.id]?.at||0)-(progress[a.id]?.at||0));
 else if(sort==='title')items.sort((a,b)=>(a.showTitle||a.title||'').localeCompare(b.showTitle||b.title||'',undefined,{numeric:true})||Number(a.season)-Number(b.season)||Number(a.episode)-Number(b.episode));
 else if(sort==='year')items.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
 // Keep individual episodes in progress views; group series in ordinary browsing.
 if(!['continue','watched'].includes(filter)){
  const seen=new Set();
  items=items.filter(item=>{const id=item.kind==='tv'?'tv:'+(item.showTitle||item.title):item.id;if(seen.has(id))return false;seen.add(id);return true;});
 }
 return items;
}

export function renderLibrary(library,progress,options={}){
 const {query='',filter='all',sort='recent',playback='all'}=options,items=selectLibrary(library,progress,options);
 const tabs=[['all','All'],['movies','Movies'],['tv','Shows'],['music','Music'],...(library.some(item=>item.category==='bodycam')?[['bodycam','Bodycam']]:[]),...(library.some(item=>item.category==='daily-dose')?[['daily-dose','Daily Dose of Internet']]:[]),['continue','Continue Watching'],['watched','Watched']];
 return `<section class="vela-library"><header class="library-heading"><div><h1>Library</h1><p>${library.length} ${library.length===1?'item':'items'}</p></div><button class="secondary" data-library-refresh aria-label="Refresh library">Refresh</button></header><div class="library-tools"><label class="library-search"><span class="sr-only">Search your library</span><input type="search" data-library-query aria-label="Search your library" placeholder="Search your library" value="${esc(query)}"></label><label class="library-playback"><span>Playback</span><select data-library-playback aria-label="Playback source">${[['all','All media'],['direct','Direct playback'],['youtube','YouTube']].map(([id,label])=>`<option value="${id}" ${playback===id?'selected':''}>${label}</option>`).join('')}</select></label><label class="library-sort"><span>Sort</span><select data-library-sort aria-label="Sort library"><option value="recent" ${sort==='recent'?'selected':''}>Recently added</option><option value="title" ${sort==='title'?'selected':''}>Title A–Z</option><option value="year" ${sort==='year'?'selected':''}>Newest release</option></select></label></div><nav class="library-filters" aria-label="Library filters">${tabs.map(([id,label])=>`<button data-library-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</nav><p class="library-result-count" role="status">${items.length} ${filter==='continue'||filter==='watched'?(items.length===1?'file':'files'):(items.length===1?'title':'titles')}${query?' found':''}</p><div class="cinema-grid">${items.map(item=>{
 const p=progress[item.id],watched=isWatched(p);
 const tile=movieTile(item,{library:true,progress:isContinuing(p)?p:undefined});
 return tile.replace('</article>',`<div class="library-item-actions">${item.kind==='tv'&&['continue','watched'].includes(filter)?`<button data-play-id="${esc(item.id)}">S${Number(item.season)||1} · E${Number(item.episode)||1}</button>`:'<span></span>'}<button class="text-button" data-watched-id="${esc(item.id)}" data-watched-value="${!watched}">${watched?'✓ Watched · Undo':'Mark watched'}</button></div></article>`);
 }).join('')}</div>${!items.length?`<div class="cinema-empty"><h3>${!library.length?'Your library starts here':'No matching titles'}</h3><p>${!library.length?'Add video or music to play solo or with friends.':'Try another search or library filter.'}</p>${!library.length?'<button data-trigger-upload>Add movie</button>':'<button data-library-reset>Clear filters</button>'}</div>`:''}</section>`;
}
