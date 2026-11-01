(() => {
  'use strict';
  const shell=document.getElementById('explore-shell');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const date=value=>value?new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Not supplied';
  const data={},pending={};
  let page='shop',libraryFilter='all',kind='all',libraryType='',libraryRarity='',librarySort='latest',query='',limit=60,library=[],newsKind='br',modeFilter='default',mapLabels=true,zoom=1;
  const endpoints={library:'/v2/cosmetics?responseFlags=6',new:'/v2/cosmetics/new',news:'/v2/news',map:'/v1/map',modes:'/v1/playlists'};
  async function load(key){
    if(data[key])return data[key];
    if(pending[key])return pending[key];
    pending[key]=fetch('https://fortnite-api.com'+endpoints[key],{signal:AbortSignal.timeout(45000)}).then(r=>{if(!r.ok)throw Error(`Service returned ${r.status}`);return r.json();}).then(p=>{if(!p.data)throw Error('No data returned');data[key]=p.data;return p.data;}).finally(()=>delete pending[key]);
    return pending[key];
  }
  function heading(title,note){return `<div class="explore-heading"><p class="eyebrow-small">ASHLAN / EXPLORE</p><h1>${title}</h1><p>${note}</p></div>`;}
  function loading(){shell.innerHTML=heading({library:'Cosmetic Library',news:'Fortnite News',map:'Island Map',modes:'Game Modes'}[page],'Loading…')+'<div class="explore-loading" role="status"><div class="skeleton-cards">'+Array(4).fill('<div class="skeleton-card"></div>').join('')+'</div>';}
  function updateNav(){document.querySelectorAll('.nav-link').forEach(b=>{const active=b.dataset.page===page||(page==='shop'&&b.dataset.view===document.querySelector('.nav-link[data-view].is-active')?.dataset.view);if(b.dataset.page)b.classList.toggle('is-active',active);if(page!=='shop'&&b.dataset.view)b.classList.remove('is-active');b.setAttribute('aria-current',b.classList.contains('is-active')?'page':'false');});}
  function showShop(event){window.scrollTo({top:0,behavior:'instant'});page='shop';shell.hidden=true;document.getElementById('hero').hidden=false;document.getElementById('shop-content').hidden=false;document.body.dataset.page='shop';document.querySelectorAll('[data-page]').forEach(b=>b.classList.remove('is-active'));const view=event?.currentTarget?.dataset.view||(event?.currentTarget?.id==='header-heart'?'favorites':'shop');document.querySelectorAll('.nav-link[data-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.view===view));}
  async function navigate(next){
    window.ashlanShop.close();page=next;query='';limit=60;document.body.dataset.page=page;
    document.getElementById('hero').hidden=true;document.getElementById('shop-content').hidden=true;shell.hidden=false;document.getElementById('search-wrap').classList.remove('is-mobile-open');updateNav();window.scrollTo({top:0,behavior:'instant'});loading();
    try{
      if(next==='library'){
        const [all,latest]=await Promise.all([load('library'),load('new')]);if(page!==next)return;
        const newIds=new Set(Object.entries(latest.items||{}).flatMap(([k,items])=>items.map(i=>k+':'+i.id)));
        library=Object.entries(all).filter(([,items])=>Array.isArray(items)).flatMap(([k,items])=>items.map(raw=>({raw,kind:k,key:k+':'+raw.id,name:raw.name||raw.title||raw.id,new:newIds.has(k+':'+raw.id),search:`${raw.name||raw.title||''} ${raw.artist||''} ${raw.description||''} ${raw.set?.value||''} ${raw.rarity?.displayValue||''} ${raw.type?.displayValue||''}`.toLowerCase()}))).sort((a,b)=>String(b.raw.added||'').localeCompare(String(a.raw.added||''))||a.name.localeCompare(b.name));
        buildLibrary();
      }else{await load(next);if(page!==next)return;if(next==='news')buildNews();if(next==='map')buildMap();if(next==='modes')buildModes();}
    }catch(error){if(page!==next)return;shell.innerHTML=heading('Couldn’t load this section','This section is temporarily unavailable. Try again.')+`<p class="media-note">${esc(error.message)}</p><button class="button button-primary" id="explore-retry">Try again</button>`;document.getElementById('explore-retry').onclick=()=>navigate(next);}
  }
  const kindName={br:'Battle Royale',tracks:'Jam Tracks',instruments:'Instruments',cars:'Vehicles',lego:'LEGO styles',legoKits:'LEGO kits',beans:'Bean styles'};
  function buildLibrary(){
    shell.innerHTML=heading('Cosmetic Library',`${library.length.toLocaleString()} items across Fortnite. Updated ${date(data.new.lastAdditions?.all||data.new.date)}.`)+`<div class="explore-toolbar"><label class="explore-search">Search library<input id="library-search" type="search" placeholder="Name, artist, set, or rarity" autocomplete="off"></label><label>Category<select id="library-kind"><option value="all">All categories</option>${Object.entries(kindName).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label><label>Item type<select id="library-type"><option value="">All types</option>${[...new Set(library.map(x=>x.raw.type?.displayValue).filter(v=>v&&v!=='null'&&v.length<30))].sort().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></label><label>Rarity / series<select id="library-rarity"><option value="">All rarities</option>${[...new Set(library.map(x=>x.raw.series?.value||x.raw.rarity?.displayValue).filter(Boolean))].sort().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></label><label>Sort by<select id="library-sort"><option value="latest">Latest added</option><option value="az">Name: A–Z</option><option value="za">Name: Z–A</option></select></label></div><div class="explore-tabs" aria-label="Library collection">${[['all','All cosmetics'],['new','New items'],['unreleased','Unreleased candidates'],['saved','Saved']].map(([k,n])=>`<button type="button" data-library-filter="${k}" aria-pressed="${k===libraryFilter}">${n}</button>`).join('')}</div><button id="library-reset" class="library-reset" type="button">Reset filters</button><p id="library-note" class="explore-note"></p><div id="library-summary" class="explore-summary" role="status"></div><div id="library-grid" class="card-grid library-grid"></div><button id="library-more" class="button button-outline load-more">Load more items</button>`;
    document.getElementById('library-kind').value=kind;
    for(const [id,value] of [['library-type',libraryType],['library-rarity',libraryRarity],['library-sort',librarySort]])document.getElementById(id).value=value;
    document.getElementById('library-type').onchange=e=>{libraryType=e.target.value;limit=60;renderLibrary();};
    document.getElementById('library-rarity').onchange=e=>{libraryRarity=e.target.value;limit=60;renderLibrary();};
    document.getElementById('library-sort').onchange=e=>{librarySort=e.target.value;limit=60;renderLibrary();};
    document.getElementById('library-search').oninput=e=>{query=e.target.value.toLowerCase().trim();limit=60;renderLibrary();};
    document.getElementById('library-kind').onchange=e=>{kind=e.target.value;limit=60;renderLibrary();};
    shell.querySelectorAll('[data-library-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.libraryFilter;limit=60;renderLibrary();});
    document.getElementById('library-more').onclick=()=>{limit+=60;renderLibrary();};
    document.getElementById('library-grid').onclick=e=>{const b=e.target.closest('[data-cosmetic]');if(!b)return;const item=library[Number(b.dataset.cosmetic)];window.ashlanShop.openCosmetic(item.raw,item.kind);};
    document.getElementById('library-reset').onclick=()=>{libraryFilter='all';kind='all';libraryType='';libraryRarity='';librarySort='latest';query='';limit=60;buildLibrary();};
    renderLibrary();
  }
  function renderLibrary(){
    if(page!=='library'||!document.getElementById('library-grid'))return;
    const items=library.filter(item=>{
      if(kind!=='all'&&item.kind!==kind)return false;if(query&&!item.search.includes(query))return false;
      if(libraryType&&item.raw.type?.displayValue!==libraryType)return false;
      if(libraryRarity&&(item.raw.series?.value||item.raw.rarity?.displayValue)!==libraryRarity)return false;
      if(libraryFilter==='new'&&!item.new)return false;
      if(libraryFilter==='saved'&&!window.ashlanShop.isSaved(item.kind,item.raw.id))return false;
      if(libraryFilter==='unreleased')return item.kind==='br'&&!item.raw.shopHistory?.length&&item.raw.gameplayTags?.includes('Cosmetics.Source.ItemShop')&&!window.ashlanShop.inShop(item.raw.id);
      return true;
    });
    if(librarySort!=='latest')items.sort((a,b)=>(librarySort==='az'?1:-1)*a.name.localeCompare(b.name));
    document.getElementById('library-note').textContent=libraryFilter==='unreleased'?'No recorded shop appearance. Release status unconfirmed.':libraryFilter==='new'?`Latest additions (${date(data.new.date)}), including items not currently sold in the shop.`:'';
    shell.querySelectorAll('[data-library-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.libraryFilter===libraryFilter)));
    document.getElementById('library-summary').textContent=`${items.length.toLocaleString()} results · showing ${Math.min(limit,items.length).toLocaleString()}`;
    document.getElementById('library-grid').innerHTML=items.slice(0,limit).map(item=>{const raw=item.raw;const image=url(raw.images?.featured||raw.images?.large||raw.images?.icon||raw.albumArt||raw.images?.smallIcon);return `<button type="button" class="library-item" data-cosmetic="${library.indexOf(item)}" aria-label="Open ${esc(item.name)}"><div class="library-art">${image?`<img src="${esc(image)}" alt="" loading="lazy" decoding="async">`:'<span>Art unavailable</span>'}${item.new?'<span class="library-new">NEW</span>':''}</div><span class="library-type">${esc(raw.type?.displayValue||kindName[item.kind])}</span><strong>${esc(item.name)}</strong><span class="library-meta">${esc(raw.artist||raw.rarity?.displayValue||'')}${window.ashlanShop.isSaved(item.kind,raw.id)?' · Saved':''}</span></button>`;}).join('')||'<p class="explore-note">No matching cosmetics. Try another search or collection.</p>';
    document.getElementById('library-more').hidden=items.length<=limit;
  }
  function buildNews(){
    shell.innerHTML=heading('Fortnite News','')+`<div class="explore-tabs"><button data-news="br">Battle Royale</button><button data-news="stw">Save the World</button></div><p id="news-updated" class="explore-note"></p><div id="news-feed" class="news-feed"></div>`;
    shell.querySelectorAll('[data-news]').forEach(b=>b.onclick=()=>{newsKind=b.dataset.news;renderNews();});renderNews();
  }
  function renderNews(){
    const feed=data.news[newsKind];shell.querySelectorAll('[data-news]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.news===newsKind)));
    document.getElementById('news-updated').textContent=`Updated ${date(feed?.date)}. `;
    const items=(feed?.motds||feed?.messages||[]).filter(n=>!n.hidden).sort((a,b)=>(b.sortingPriority||0)-(a.sortingPriority||0));
    document.getElementById('news-feed').innerHTML=items.map(n=>`<article class="news-story">${url(n.image||n.tileImage)?`<img src="${esc(url(n.image||n.tileImage))}" alt="" loading="lazy">`:''}<div><p class="eyebrow-small">${newsKind==='br'?'BATTLE ROYALE':'SAVE THE WORLD'}</p><h2>${esc(n.title||n.tabTitle)}</h2><p>${esc(n.body)}</p>${url(n.websiteUrl)?`<a href="${esc(url(n.websiteUrl))}" target="_blank" rel="noopener noreferrer">Read more ↗</a>`:''}</div></article>`).join('')||'<p>No announcements supplied for this feed.</p>';
  }
  function buildMap(){
    const map=data.map;
    shell.innerHTML=heading('Island Map','')+`<div class="map-toolbar"><label><input id="map-labels" type="checkbox" checked> Show place names</label><div><button id="map-out" class="button button-outline" aria-label="Zoom map out">−</button><button id="map-reset" class="button button-outline">Reset zoom</button><button id="map-in" class="button button-outline" aria-label="Zoom map in">+</button></div><a class="button button-outline" target="_blank" rel="noopener noreferrer" href="${esc(url(map.images.pois))}">Open full map ↗</a></div><div class="map-layout"><div class="map-viewport" tabindex="0" aria-label="Map viewport; scroll to pan when zoomed"><img id="island-map" alt="Fortnite island map with named points of interest" src="${esc(url(map.images.pois))}"></div><aside class="map-locations"><label class="explore-search">Find a location<input id="poi-search" type="search" placeholder="Search places"></label><p class="explore-note">${map.pois.length} locations · select one for coordinates</p><div id="poi-list"></div></aside></div>`;
    mapLabels=true;zoom=1;
    document.getElementById('map-labels').onchange=e=>{mapLabels=e.target.checked;document.getElementById('island-map').src=url(map.images[mapLabels?'pois':'blank']);document.getElementById('island-map').alt=`Fortnite island map${mapLabels?' with named points of interest':''}`;};
    const setZoom=value=>{zoom=Math.max(1,Math.min(4,value));document.getElementById('island-map').style.width=zoom*100+'%';document.getElementById('map-reset').textContent=`Reset zoom · ${Math.round(zoom*100)}%`;document.getElementById('map-out').disabled=zoom===1;document.getElementById('map-in').disabled=zoom===4;};
    document.getElementById('map-in').onclick=()=>setZoom(zoom+.5);document.getElementById('map-out').onclick=()=>setZoom(zoom-.5);document.getElementById('map-reset').onclick=()=>setZoom(1);
    function places(q=''){document.getElementById('poi-list').innerHTML=map.pois.filter(p=>p.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<details class="poi"><summary>${esc(p.name)}</summary><p>World coordinates<br>X ${esc(Math.round(p.location.x))} · Y ${esc(Math.round(p.location.y))} · Z ${esc(Math.round(p.location.z))}</p></details>`).join('')||'<p>No matching locations.</p>';}
    document.getElementById('poi-search').oninput=e=>places(e.target.value.toLowerCase().trim());places();setZoom(1);
  }
  function buildModes(){
    shell.innerHTML=heading('Game Modes','Explore playlists and game modes.')+`<div class="explore-toolbar"><label class="explore-search">Search game modes<input type="search" id="mode-search" placeholder="Name or description"></label><label>Collection<select id="mode-filter"><option value="default">Core playlists</option><option value="all">All playlists</option><option value="ltm">Limited time modes</option><option value="tournament">Tournaments</option><option value="large">Large team games</option></select></label></div><div id="mode-summary" class="explore-summary" role="status"></div><div id="mode-list" class="mode-list"></div><button id="mode-more" class="button button-outline load-more">Load more modes</button>`;
    document.getElementById('mode-filter').value=modeFilter;document.getElementById('mode-search').oninput=e=>{query=e.target.value.toLowerCase().trim();limit=60;renderModes();};document.getElementById('mode-filter').onchange=e=>{modeFilter=e.target.value;limit=60;renderModes();};document.getElementById('mode-more').onclick=()=>{limit+=60;renderModes();};renderModes();
  }
  function renderModes(){
    const items=data.modes.filter(m=>{if(query&&!`${m.name} ${m.description} ${m.id}`.toLowerCase().includes(query))return false;return modeFilter==='default'?m.isDefault:modeFilter==='ltm'?m.isLimitedTimeMode:modeFilter==='tournament'?m.isTournament:modeFilter==='large'?m.isLargeTeamGame:true;}).sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id)));
    document.getElementById('mode-summary').textContent=`${items.length} playlists · showing ${Math.min(items.length,limit)}`;
    document.getElementById('mode-list').innerHTML=items.slice(0,limit).map(m=>`<article class="mode-row"><div><p class="eyebrow-small">${esc(m.gameType?.replace('EFortGameType::','')||'PLAYLIST')}</p><h2>${esc(m.name||m.id)}</h2><p>${esc(m.description||'No description supplied.')}</p></div><div class="mode-facts">${[['Players',m.maxPlayers],['Team size',m.maxTeamSize]].filter(([,n])=>n>0).map(([label,n])=>`<span>${label}<strong>${esc(n)}</strong></span>`).join('')}${m.isLimitedTimeMode?'<span>Limited time</span>':''}${m.isTournament?'<span>Tournament</span>':''}</div><details><summary>Playlist details</summary><p>${esc(m.id)}</p><p>Added ${date(m.added)}</p><p>Counts toward profile stats: ${m.accumulateToProfileStats?'Yes':'No'}</p></details></article>`).join('')||'<p>No matching game modes.</p>';
    document.getElementById('mode-more').hidden=items.length<=limit;
  }
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',showShop));document.getElementById('brand-link').addEventListener('click',showShop);document.getElementById('header-heart').addEventListener('click',showShop);
  window.addEventListener('ashlan-favorites-changed',renderLibrary);
  async function openSharedCosmetic(){
    if(!location.hash.startsWith('#cosmetic='))return;
    try{
      const id=decodeURIComponent(location.hash.slice(10));
      await navigate('library');
      const item=library.find(x=>'cosmetic-'+x.kind+'-'+x.raw.id===id);
      if(item)window.ashlanShop.openCosmetic(item.raw,item.kind);
    }catch{}
  }
  window.addEventListener('hashchange',openSharedCosmetic);
  openSharedCosmetic();
})();
