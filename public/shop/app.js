(() => {
  'use strict';

  const API_URL = 'https://fortnite-api.com/v2/shop?language=en&responseFlags=7';
  const TRACKS_URL = 'https://raw.githubusercontent.com/FNFestival/fnfestival.github.io/main/data/tracks.json';
  const CACHE_KEY = 'ashlan-shop-cache-v6';
  const FAVORITES_KEY = 'pixl-shop-favorites-v2';
  const VBUCK_FALLBACK = 'https://fortnite-api.com/images/vbuck.png';
  const MAX_CACHE_AGE = 72 * 60 * 60 * 1000;
  const libraryItems = new Map();
  const ANIMATIONS={
    "CID_744_Athena_Commando_F_DuckHero":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/PQQx06mn_G24ntC97FHvedM4bXtxd2RdsRD5_Jq8Md8/webm-lg",
    "Character_CasualCherie":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/WRHHhcb50uj6FpTSdnKBPJsbD6fiDtTQjuEaG7mw96E/webm-lg",
    "Character_HappyHopper":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/NGnlj5dNOnGDLEtdFWqQa6ciPuatDb16C2F4eIB53gg/webm-lg",
    "CID_741_Athena_Commando_F_HalloweenBunnySpring":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/PXarlnUBy0e5RZFCv7XrkhgX6pchtPrEJzbPbqqJpsI/webm-lg",
    "Character_GiraffeScallion":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/tsStSKzBOCH7zzquz7ICPOMuvXmQfKHGuGOWXjl6_yU/webm-lg",
    "EID_GiraffeScallion":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/LjR74-rguXFJg3od-Q8OVNdxS6RUa1I8IFez1u3ucO4/webm-lg",
    "EID_PintPiano":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/AGgIhHLq1xxWDVCWwfGSTtfguVZlrxfgLduePGW1wHs/webm-lg",
    "EID_Aerobics":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/gxwujIXWctowNsY99n00PxNx1JwMg4FIXH4dLsdg8JM/webm-lg",
    "Character_ByteGear":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/yoVCN-SW5ucaO7VXCvHpibt98JJ34j-BEfswS3lL9Yo/webm-lg",
    "EID_RageQuit":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/c4wsY_hmfDjgnCL5vJbvUuTb0t0RQPLnujxhrlK4xwo/webm-lg",

    "CID_170_Athena_Commando_F_Luchador":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/DvQM11lP-L2Maw065CloORVnYl16p0FnHEZUmsbuVY4/webm-lg",
    "CID_397_Athena_Commando_F_TreasureHunterFashion":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/vzKvPKHFi8RU3AVhpo5ZJJNBpG04Ok1JmMgOFAKVf2w/webm-lg",
    "Character_Jumpsuit_Scrap_Mutable":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/wLPrdHL8Jt9ZFyooAVukCVISCjIKr2Hgoo376JWHnBE/webm-lg",
    "CID_124_Athena_Commando_F_AuroraGlow":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/Of9pBO7DQXG95Cz_wPltdPbHYv36LXkfaaiA_06fty0/webm-lg",
    "Character_DimeAviator":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/DLVsOtKnDFFG5kze1CWzUwD-FsnjaUSbh3m_C29yUVQ/webm-lg",
    "Character_SolidMist":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/YGXWeEk_DckCeOJe4SbKtD82CuvmwvPZ6UrnRNB5SWU/webm-lg",
    "Character_MoralKoreLine":"https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/YlBFmeQQSciX8LMK923kNuXx8eU3Yj5t7D4p9r-aFJQ/webm-lg",

    EID_AsideDepot:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/H3HgEEdjx5BVpeSiPN79oCZUqqqiVEiGxtoBxZT26cU/webm-lg',
    EID_AsideDepotStair:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/Pu1VreW3GXYc6S8qf8YG8T9xFcU8ACZ7M-pgLS8lBF0/webm-lg',
    EID_CargoLying:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/UyE3NfCPV0yf0wSFezQ4z1xDQLMBYQ-KkK5ovu9z_Wg/webm-lg',
    Character_FonduePaper:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/bGBJiGRWQRPYjChCL9BEKhwDxCZ7fYIN9X6EV4hbou0/webm-lg',
    EID_ZombieWalk:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/32750jOXYbs6NrDqUHbCoDBTRq4ivBhcGs_L2HbP5Mc/webm-lg',
    EID_CoffinBooBox:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/4OPLZjROU1t44IaMtIUDPmNtGJ_RpF32XxpExKmbFZk/webm-lg',
    Character_SugarBrain:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/rXdohYmnvE7r4qxRwh-Le7lvFzb4BiKfrVjF9xIQgug/webm-lg',
    Character_PumpkinSkeleton:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/639IcfUjW1bFQ7R-NJAwaK6oB71T0zAkBASCMHz4Exc/webm-lg',
    CID_244_Athena_Commando_M_PumpkinSuit:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/0B2ENAqbfN9ddQoxpauNcTYTmeR-s8Vlgj69ZBriy5s/webm-lg',
    CID_256_Athena_Commando_M_Pumpkin:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/--O3Ga8L4qe70IGTiz-u7HzlM2sWTxzK91qvAlFJpeI/webm-lg',
    EID_GuardHence:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/5rer1cTOV06Eq7Bs3oXPrbShRuZxyZpy9sFUfZ-JLPw/webm-lg',
    EID_TearErrand:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/JGtYj0QGGDZ-43p9-YT7M0WwxajyM71FAckc_jUimIs/webm-lg',
    EID_AcidWhale:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/XXPsPf2EsX8_4UXDCcWFWmxKao6GkX06iQtj88LRNlM/webm-lg',
    EID_SmoothGriffin:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/mAJv8vKE5THm313pFFAU4tJSTesO9X6WYkwlbIcQi1o/webm-lg',
    EID_CarryMazeFlap:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/M66o0CSjFr22B4uT6RHXEqO__UAGj7jAoZRuUMteBcE/webm-lg',

    Character_AsideDepot:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/km3JQT9rhuJxmcrHuRHaOGuOEGRTSGMLqKznLXK-Tr0/webm-lg',
    Character_CargoLying:'https://cosmo.fdeb.live.use1a.on.epicgames.com/v1/item/Yr4_CjhAJK91kX4vdB1Q8A2hMYHEmXUy-KYLE9A3SVw/webm-lg'
  };
  const itemAt = index => index < 0 ? libraryItems.get(index) : state.items[index];

  const $ = (id) => document.getElementById(id);
  const state = { items: [], view: 'shop', filter: 'all', query: '', sort: 'shop', advanced:{section:'',rarity:'',price:'',collection:'',media:''}, featured: null, active: null, favorites: new Set(), shopDate: null, live: false, fetching: false, toastTimer: null, lastFocused: null };
  const ui = {
    header: $('header'), hero: $('hero'), heroArt: $('hero-art'), heroGlow: $('hero-glow'), heroBackdrop: $('hero-backdrop'), heroTitle: $('hero-title'), heroDescription: $('hero-description'), heroType: $('hero-type'), heroPrice: $('hero-price'), heroDate: $('hero-date'), heroCaption: $('hero-caption'), heroCountdown: $('hero-countdown'), heroInfo: $('hero-info'), results: $('shop-results'), itemCount: $('item-count'), statusPill: $('status-pill'), statusLabel: $('status-label'), heading: $('section-heading'), overline: $('section-overline'), notice: $('notice'), noticeText: $('notice-text'), search: $('search'), modal: $('modal'), modalPanel: $('modal-panel'), modalArtFrame: $('modal-art-frame'), modalImage: $('modal-image'), modalTitle: $('modal-title'), modalCategory: $('modal-category'), modalTags: $('modal-tags'), modalDescription: $('modal-description'), modalPrice: $('modal-price'), modalOldPrice: $('modal-old-price'), modalIncludes: $('modal-includes'), includedList: $('included-list'), modalDetails: $('modal-details'), modalSave: $('modal-save'), toast: $('toast')
  };

  // All third-party text is escaped before being inserted into HTML.
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeImage(raw) {
    if (!raw || typeof raw !== 'string') return '';
    try { const url = new URL(raw); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
  }
  function icon(name) { return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
  function vbucks(price) {
    if (price === null || price === undefined || Number(price) < 0) return '<span>Price unavailable</span>';
    return `<img class="vbuck-symbol" alt="V-Bucks" src="${VBUCK_FALLBACK}"><span>${Number(price).toLocaleString('en-US')}</span>`;
  }
  function hexColor(raw, fallback) {
    const hex = typeof raw === 'string' ? raw.replace(/^#/, '').slice(0, 6) : '';
    return /^[0-9a-fA-F]{6}$/.test(hex) ? '#' + hex : fallback;
  }
  function displayDate(date) {
    const d = new Date(date);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Today';
  }
  function shortDate(date) {
    const d = new Date(date);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;
  }
  function categoryFor(entry) {
    if (entry.bundle && entry.bundle.name) return 'bundle';

    const type = String(entry.brItems?.[0]?.type?.value || '').toLowerCase();
    if (type === 'outfit') return 'outfit';
    if (['emote','emoji','spray'].includes(type)) return 'emote';
    if (['pickaxe'].includes(type)) return 'pickaxe';
    if (entry.tracks?.length) return 'music';
    if (entry.cars?.length) return 'car';
    if (entry.instruments?.length) return 'instrument';
    return 'other';
  }
  function normalize(entry, index, shopDate) {
    if (!entry || typeof entry !== 'object') return null;
    const brItems = Array.isArray(entry.brItems) ? entry.brItems : [];
    const tracks = Array.isArray(entry.tracks) ? entry.tracks : [];
    const instruments = Array.isArray(entry.instruments) ? entry.instruments : [];
    const cars = Array.isArray(entry.cars) ? entry.cars : [];
    const primary = brItems[0] || null;
    const category = categoryFor(entry);
    const display = entry.newDisplayAsset || {};
    const bundle = entry.bundle || null;
    const content = [...brItems, ...tracks, ...instruments, ...cars];
    const name = bundle?.name || primary?.name || tracks[0]?.title || instruments[0]?.name || cars[0]?.name || display?.displayName || entry.devName?.replace(/^\[VIRTUAL\]/,'').slice(0,54) || 'Item Shop Offer';
    const section = entry.layout?.name || 'More in the Shop';
    const brRender=display.renderImages?.find(x=>x.productTag==='Product.BR'&&x.image)?.image;
    const image = safeImage(bundle?.image) || (primary ? safeImage(brRender)||safeImage(primary.images?.featured)||safeImage(primary.images?.icon) : safeImage(tracks[0]?.albumArt)||safeImage(instruments[0]?.images?.large)||safeImage(instruments[0]?.images?.icon)||safeImage(cars[0]?.images?.large)||safeImage(cars[0]?.images?.icon)) || safeImage(display.renderImages?.find(x=>x?.image)?.image) || '';
    const fallbackImage = safeImage(primary?.images?.icon) || safeImage(tracks[0]?.albumArt) || safeImage(instruments[0]?.images?.icon) || safeImage(cars[0]?.images?.icon) || '';
    const description = primary?.description || bundle?.info || tracks[0]?.artist || '';
    const typeLabel = category === 'bundle' ? 'Bundle' : (primary?.type?.displayValue ? primary.type.displayValue+(content.length>1?' + Bonus':'') : '') || (tracks.length ? 'Jam Track' : instruments.length ? 'Instrument' : cars.length ? 'Vehicle' : 'Shop Item');
    const rarity = primary?.series?.value || primary?.rarity?.displayValue || '';
    const price = typeof entry.finalPrice === 'number' ? entry.finalPrice : null;
    const regular = typeof entry.regularPrice === 'number' ? entry.regularPrice : null;
    const addedDate = entry.inDate || '';
    const dateOnly = String(addedDate).slice(0, 10);
    const todayOnly = String(shopDate || '').slice(0, 10);
    const isNew = Boolean(dateOnly && todayOnly && dateOnly === todayOnly);
    const contentItems = content.map((item) => ({ id:item.id, name: item.name || item.title || 'Item', image: safeImage(item.images?.icon) || safeImage(item.albumArt) || safeImage(item.images?.smallIcon) || '' }));
    return {
      ownershipKeys:content.map(x=>x.id).filter(Boolean),tileSize:entry.tileSize||'',
      isFirstRelease:Boolean(primary?.shopHistory?.[0]&&primary.shopHistory[0].slice(0,10)===todayOnly),
      id: String(entry.offerId || 'offer-' + index), index, name: String(name).replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\_/g,'_'), section: String(section), sectionOrder: Number(entry.layout?.index ?? 999), layoutRank: Number(entry.layout?.rank ?? 999), image, fallbackImage, price, regular, typeLabel, category, rarity, description: String(description), isNew, inDate: addedDate, outDate: entry.outDate || '', colors: [hexColor(entry.colors?.color1,'#514554'), hexColor(entry.colors?.color2 || entry.colors?.color3,'#242327')], contentItems, search: '',
      track: tracks[0] || null, cosmeticId: primary?.id || null, showcase: primary?.showcaseVideo || null, introduction: primary?.introduction?.text || '', set: primary?.set?.value || '', variants: primary?.variants || [], history: primary?.shopHistory || [], giftable: entry.giftable,
    };
  }
  function normalizeShop(payload) {
    const data = payload?.data;
    if (!Array.isArray(data?.entries)) throw Error('Unexpected item shop response.');
    const date = data.date || new Date().toISOString();
    const items = data.entries.map((entry,i) => normalize(entry, i, date)).filter(Boolean);
    items.forEach((item,i) => { item.index = i; });
    if (!items.length) throw Error('The item shop is currently empty.');
    for (const item of items) item.search = `${item.name} ${item.section} ${item.typeLabel} ${item.rarity} ${item.description} ${item.contentItems.map(x=>x.name).join(' ')}`.toLowerCase();
    return { date, items };
  }
  function readFavorites() {
    try { const list = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); if (Array.isArray(list)) state.favorites = new Set(list.filter(x => typeof x === 'string').slice(0,2000)); } catch { /* ignore */ }
    updateFavCount();
    try { for(const item of JSON.parse(localStorage.getItem('ashlan-library-saved')||'[]')){if(item?.catalog&&item.id){item.index=-(libraryItems.size+1);libraryItems.set(item.index,item);}} }catch{}
  }
  function updateFavCount() { const el = $('fav-count'); el.textContent = state.favorites.size; el.hidden = !state.favorites.size; }
  function toggleFavorite(index) {
    const item = itemAt(index); if (!item) return;
    const saved = state.favorites.has(item.id);
    if (saved) state.favorites.delete(item.id); else state.favorites.add(item.id);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites])); } catch { /* storage unavailable */ }
    try {localStorage.setItem('ashlan-library-saved',JSON.stringify([...libraryItems.values()].filter(x=>state.favorites.has(x.id))));}catch{}
    window.dispatchEvent(new Event('ashlan-favorites-changed'));
    updateFavCount();
    if (state.view === 'favorites') renderItems();
    else document.querySelectorAll(`[data-heart="${index}"]`).forEach((el) => { el.classList.toggle('is-saved',!saved); el.setAttribute('aria-label',`${saved?'Save':'Remove'} ${item.name} ${saved?'to':'from'} My List`); });
    if (state.active === index) updateModalSave();
    showToast(saved ? 'Removed from My List' : 'Added to My List');
  }
  function showToast(msg) { clearTimeout(state.toastTimer); ui.toast.textContent = msg; ui.toast.classList.add('is-visible'); state.toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'),2000); }
  function setStatus(status, label) { ui.statusPill.dataset.status = status; ui.statusLabel.textContent = label; }
  function showNotice(message) { ui.noticeText.textContent = message; ui.notice.hidden = false; }
  function clearNotice() { ui.notice.hidden = true; }
  function cache(shop) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({date:shop.date,items:shop.items, cachedAt:Date.now()})); } catch { /* may exceed quota */ }
  }
  function readCache() {
    try { const cached = JSON.parse(localStorage.getItem(CACHE_KEY)); if (cached && Array.isArray(cached.items) && typeof cached.cachedAt === 'number' && Date.now() - cached.cachedAt < MAX_CACHE_AGE) return cached; } catch { /* ignore */ }
    return null;
  }
  async function fetchShop() {
    if (state.fetching) return;
    state.fetching = true;
    if (!state.items.length) setStatus('loading','Connecting');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let res;
      try { res = await fetch(API_URL + '&_=' + Date.now(), { signal: controller.signal, cache: 'no-store' }); }
      finally { clearTimeout(timer); }
      if (!res.ok) throw Error('Shop service returned HTTP ' + res.status);
      const shop = normalizeShop(await res.json());
      state.items = shop.items;
      state.shopDate = shop.date;
      state.live = true;
      cache(shop);
      clearNotice();
      setStatus('live', 'Live shop');
      renderAll();
      loadTrackPreviews();
    } catch (error) {
      state.live = false;
      if (!state.items.length) {
        const cached = readCache();
        if (cached) { state.items = cached.items; state.shopDate = cached.date; }
      }
      if (state.items.length) {
        setStatus('offline', 'Saved copy');
        showNotice(`Live shop couldn't be reached. Showing the ${displayDate(state.shopDate)} saved shop instead.`);
        renderAll();
        loadTrackPreviews();
      } else {
        setStatus('error','Unavailable');
        ui.itemCount.textContent = 'No data';
        ui.hero.classList.remove('is-loading');
        ui.results.innerHTML = `<div class="empty-state">${icon('bag')}<h3>Shop temporarily unavailable</h3><p>Couldn't connect to the Fortnite item shop. Check your connection and try again.</p><button type="button" id="empty-retry">Retry connection</button></div>`;
        ui.results.setAttribute('aria-busy','false');
        $('empty-retry')?.addEventListener('click',fetchShop);
      }
      console.warn('Ashlan Shop: live item shop unavailable:',error?.message || error);
    } finally { state.fetching = false; }
  }
  function nextReset(now) { const next = new Date(now); next.setUTCHours(24,0,0,0); return next.getTime(); }
  let previousReset = nextReset(new Date());
  function updateCountdown() {
    const now = Date.now(); const reset = nextReset(new Date(now));
    const remaining = Math.max(0,Math.floor((reset-now)/1000));
    const h = String(Math.floor(remaining/3600)).padStart(2,'0');
    const m = String(Math.floor((remaining%3600)/60)).padStart(2,'0');
    const s = String(remaining%60).padStart(2,'0');
    ui.heroCountdown.textContent = `${h}:${m}:${s}`;
    if (previousReset !== reset) { previousReset = reset; setTimeout(fetchShop,15000); }
  }
  function selectFeatured() {
    const picks = state.items.filter(x => x.category === 'outfit' && x.image);
    const newPicks = picks.filter(x => x.isNew);
    const bundles = state.items.filter(x => x.category === 'bundle' && x.image);
    const candidates = newPicks.length ? newPicks : picks.length ? picks : bundles.length ? bundles : state.items.filter(x=>x.image);
    return candidates.sort((a,b) => a.sectionOrder - b.sectionOrder || a.layoutRank - b.layoutRank)[0] || state.items[0];
  }
  function renderHero() {
    const item = selectFeatured(); state.featured = item?.index ?? null;
    if (!item) return;
    ui.hero.classList.remove('is-loading'); ui.hero.classList.add('is-ready');
    ui.heroDate.textContent = displayDate(state.shopDate).toUpperCase();
    ui.heroCaption.textContent = state.live ? 'THE DAILY ROTATION' : 'SAVED SHOP SNAPSHOT';
    ui.heroTitle.textContent = item.name;
    ui.heroDescription.textContent = item.description || `Explore ${item.name} and everything else in today's Fortnite Item Shop.`;
    ui.heroType.textContent = item.typeLabel;
    ui.heroPrice.innerHTML = vbucks(item.price);
    ui.heroGlow.style.background = `radial-gradient(ellipse at 72% 38%,${item.colors[0]}55,transparent 51%)`;
    if (item.image) {
      ui.heroArt.src = item.image; ui.heroArt.alt = item.name;
      ui.heroBackdrop.style.backgroundImage = `url("${item.image.replace(/["\\]/g,'')}")`;
      ui.heroArt.onerror = () => { if (item.fallbackImage && ui.heroArt.src !== item.fallbackImage) { ui.heroArt.src = item.fallbackImage; return; } ui.heroArt.removeAttribute('src'); ui.heroArt.alt = ''; };
    }
  }
  function filteredItems() {
    const source = state.view==='favorites' ? [...state.items,...libraryItems.values()] : state.items;
    let items = source.filter(item => {
      if (state.view === 'favorites' && !state.favorites.has(item.id)) return false;
      if (state.view === 'new' && !item.isNew) return false;
      if (state.filter === 'other' && ['outfit','emote','pickaxe','bundle','music','car','instrument'].includes(item.category)) return false;
      if (state.filter !== 'all' && state.filter !== 'other' && item.category !== state.filter) return false;
      if (state.query && !item.search.includes(state.query)) return false;
      const f=state.advanced;
      if(f.section&&item.section!==f.section)return false;
      if(f.rarity&&item.rarity!==f.rarity)return false;
      if(f.price){const [min,max]=f.price.split(':').map(Number);if(item.price==null||item.price<min||item.price>max)return false;}
      if(f.collection==='new'&&!item.isNew)return false;
      if(f.collection==='sale'&&!(item.regular>item.price))return false;
      if(f.collection==='owned'&&!window.ashlanShop.owns?.(item))return false;
      if(f.collection==='unowned'&&window.ashlanShop.owns?.(item))return false;
      if(f.media==='animation'&&!ANIMATIONS[item.cosmeticId])return false;
      if(f.media==='audio'&&!item.preview)return false;
      if(f.media==='any'&&!ANIMATIONS[item.cosmeticId]&&!item.preview&&!item.showcase)return false;
      return true;
    });
    if (state.sort === 'low') items = items.sort((a,b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (state.sort === 'high') items = items.sort((a,b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    if(state.sort==='az')items.sort((a,b)=>a.name.localeCompare(b.name));
    if(state.sort==='leaving')items.sort((a,b)=>(Date.parse(a.outDate)||Infinity)-(Date.parse(b.outDate)||Infinity));
    return items;
  }
  function cardHTML(item, order) {
    const saved = state.favorites.has(item.id);
    const price = vbucks(item.price);
    const old = item.regular != null && item.price != null && item.regular > item.price ? `<span class="price-old">${item.regular.toLocaleString('en-US')}</span>` : '';
    const image = item.image ? `<img class="item-art" src="${esc(item.image)}" data-fallback-image="${esc(item.fallbackImage || '')}" alt="${esc(item.name)}" loading="lazy" decoding="async">` : `<div class="card-no-art">${icon('bag')}</div>`;
    return `<article class="item-card ${item.track?'is-track':''}" role="button" tabindex="0" aria-label="View ${esc(item.name)} details" data-open="${item.index}" style="--item-light:${item.colors[0]};--item-dark:${item.colors[1]};animation-delay:${Math.min(order,8)*22}ms"><div class="item-bg"></div>${image}<div class="item-scrim"></div>${item.isFirstRelease ? '<span class="card-new">NEW!</span>' : ''}<button class="card-heart ${saved?'is-saved':''}" type="button" data-heart="${item.index}" aria-label="${saved?'Remove':'Save'} ${esc(item.name)} ${saved?'from':'to'} My List" title="${saved?'Remove from':'Save to'} My List">${icon('heart')}</button><div class="item-info"><span class="item-type">${esc(item.track?.artist || item.typeLabel)}</span><span class="item-title">${esc(item.name)}</span><span class="item-price-line">${price}${old}</span></div>${item.preview ? `<button class="card-play" data-play="${item.index}" aria-label="Preview ${esc(item.name)}">▶</button>`:''}</article>`;
  }
  function groupRows(items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.section;
      if (!groups.has(key)) groups.set(key,{name:key,order:item.sectionOrder,rank:item.layoutRank,items:[]});
      groups.get(key).items.push(item);
    }
    return [...groups.values()].sort((a,b)=>Number(b.name.trim()==='Beetlejuice')-Number(a.name.trim()==='Beetlejuice')||a.order-b.order || a.rank-b.rank || a.name.localeCompare(b.name));
  }
  function renderRows(items) {
    const groups = groupRows(items);
    $('section-rail').innerHTML=groups.map((group,g)=>`<a href="#section-${g}" title="${esc(group.name)}" aria-label="Jump to ${esc(group.name)}"><span></span><span class="rail-name">${esc(group.name)}</span></a>`).join('');
    return groups.map((group,g) => {
      const ordered=[...group.items].sort((a,b)=>Number(b.category==='bundle')-Number(a.category==='bundle')||(a.category==='bundle'&&b.category==='bundle'?b.contentItems.length-a.contentItems.length:0));
      return `<section class="shop-row" id="section-${g}" aria-label="${esc(group.name)}"><div class="row-top"><div class="row-left"><h3 class="row-heading">${esc(group.name)}</h3><span class="row-count">${group.items.length}</span></div></div><div class="shop-section-grid">${ordered.map((x,i)=>cardHTML(x,i).replace('class="item-card ',`class="item-card ${i===0&&x.category==='bundle'?'feature-tile ':''}`)).join('')}</div></section>`;
    }).join('');
  }
  function renderGrid(items) {
    const title = state.query ? `Results for “${esc(ui.search.value.trim())}”` : state.view === 'favorites' ? 'My List' : state.view === 'new' ? 'New Today' : state.filter === 'all' ? 'Shop Items' : document.querySelector(`.category[data-filter="${state.filter}"]`)?.textContent || 'Shop Items';
    return `<section class="grid-results"><div class="results-heading"><h3>${title}</h3><span>${items.length} ${items.length === 1?'item':'items'}</span></div><div class="card-grid">${items.map((item,i)=>cardHTML(item,i)).join('')}</div></section>`;
  }
  function renderEmpty() {
    let title='No matching items', desc='Try another search or choose a different category.';
    if (state.view === 'favorites' && !state.query && state.filter === 'all') {title='Your list is empty';desc='Tap the heart on any shop item to save it here.';}
    else if (state.view === 'new' && !state.query && state.filter === 'all') {title='No new items today';desc='There are no offers marked as newly added in the current shop.';}
    return `<div class="empty-state">${icon('search')}<h3>${title}</h3><p>${desc}</p><button type="button" id="clear-filters">Browse all items</button></div>`;
  }
  function renderItems() {
    if (!state.items.length) return;
    refreshFilterOptions();
    const items = filteredItems();
    $('filter-results').textContent=`${items.length} of ${state.items.length} items`;
    const filterCount=Object.values(state.advanced).filter(Boolean).length+Number(state.filter!=='all');$('filter-count').textContent=filterCount;$('filter-count').hidden=!filterCount;
    ui.itemCount.textContent = `${state.items.length} offers`;
    const viewNames={shop:["ASHLAN SANDBOX", "Item Shop"],new:["JUST ADDED",'New Today'],favorites:['SAVED ITEMS','My List']};
    const [overline,heading] = viewNames[state.view]; ui.overline.textContent = overline; ui.heading.textContent = heading;
    const isRows = state.view === 'shop' && state.filter === 'all' && !state.query && state.sort === 'shop' && !Object.values(state.advanced).some(Boolean);
    $('section-rail').hidden=!isRows;
    ui.results.innerHTML = !items.length ? renderEmpty() : isRows ? renderRows(items) : renderGrid(items);
    ui.results.setAttribute('aria-busy','false');
    window.dispatchEvent(new Event('ashlan-shop-rendered'));
    $('clear-filters')?.addEventListener('click',()=>{state.view='shop';resetFilters();});
    if (isRows) setupRowArrows();
  }
  function setupRowArrows() {
    for (const track of ui.results.querySelectorAll('.horizontal-track')) {
      const id = track.dataset.track;
      const buttons = ui.results.querySelectorAll(`[data-scroll="${id}"]`);
      const update = () => { const max = track.scrollWidth - track.clientWidth; buttons.forEach(b=>{b.disabled = b.dataset.dir === '-1' ? track.scrollLeft < 10 : track.scrollLeft >= max - 10;}); };
      track.addEventListener('scroll',update,{passive:true});
      setTimeout(update,0);
    }
  }
  function updateControls() {
    document.querySelectorAll('.nav-link[data-view]').forEach(el=>el.classList.toggle('is-active',(!document.body.dataset.page||document.body.dataset.page==='shop')&&el.dataset.view===state.view));
    document.querySelectorAll('.category').forEach(el=>{const selected=el.dataset.filter===state.filter;el.classList.toggle('is-active',selected);el.setAttribute('aria-pressed',String(selected));});
    $('sort-label').textContent = {shop:'Shop order',low:'Price: low to high',high:'Price: high to low',az:'Name: A–Z',leaving:'Leaving soon'}[state.sort];
    $('filter-sort').value=state.sort;
  }
  function renderAll() { renderHero();updateControls();renderItems(); }
  function openItem(index) {
    const item=itemAt(index); if (!item) return;
    $('track-audio').pause();
    state.active=index;state.lastFocused=document.activeElement;
    ui.modalTitle.textContent=item.name;
    ui.modalCategory.textContent=(item.section||'ITEM SHOP').toUpperCase();
    ui.modalDescription.textContent=item.description || 'Available in the Fortnite Item Shop.';
    ui.modalTags.innerHTML=[item.typeLabel,item.rarity,item.isNew?'New today':null].filter(Boolean).map(t=>`<span class="modal-tag">${esc(t)}</span>`).join('');
    ui.modalPrice.innerHTML=item.catalog?'<span class="catalog-availability">'+esc(item.availability)+'</span>':vbucks(item.price);
    ui.modalOldPrice.textContent=item.regular!=null&&item.price!=null&&item.regular>item.price?`${item.regular.toLocaleString('en-US')} V-Bucks`:'';
    ui.modalArtFrame.style.setProperty('--item-light',item.colors[0]);
    ui.modalArtFrame.style.setProperty('--item-dark',item.colors[1]);
    if(item.image){ui.modalImage.src=item.image;ui.modalImage.alt=item.name;ui.modalImage.hidden=false;ui.modalImage.onerror=()=>{if(item.fallbackImage && ui.modalImage.src!==item.fallbackImage){ui.modalImage.src=item.fallbackImage;return;}ui.modalImage.hidden=true;};}else{ui.modalImage.hidden=true;}
    const included=item.contentItems.filter(i=>i.image);
    ui.modalIncludes.hidden=item.contentItems.length<2;
    ui.includedList.innerHTML=included.map((i)=>`<div class="included-item"><img src="${esc(i.image)}" alt="${esc(i.name)}" loading="lazy"><span>${esc(i.name)}</span></div>`).join('');
    if (item.contentItems.length>included.length) ui.includedList.innerHTML+=`<span class="modal-tag">+${item.contentItems.length-included.length} other items</span>`;
    const details=[['Section',item.section],['Rarity',item.rarity],['Available since',shortDate(item.inDate)],['Leaves shop',shortDate(item.outDate)]].filter(x=>x[1]);
    ui.modalDetails.innerHTML=details.map(([a,b])=>`<div class="detail-row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
    updateModalSave();
    renderMedia(item,true);
    renderExtraDetails(item);
    window.dispatchEvent(new CustomEvent('ashlan-item-opened',{detail:item}));
    ui.modal.hidden=false;ui.modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
    $('modal-close').focus();
  }
  function updateModalSave() {
    if (state.active===null) return; const item=itemAt(state.active);if(!item)return;
    const saved=state.favorites.has(item.id);
    ui.modalSave.innerHTML=`${icon(saved?'check':'heart')}<span>${saved?'Saved to My List':'Save to My List'}</span>`;
  }
  function closeItem() { if(ui.modal.hidden)return;$('modal-media').replaceChildren();$('stage-showcase').replaceChildren();$('stage-showcase').hidden=true;$('stage-video').pause();$('stage-video').removeAttribute('src');$('stage-video').load();$('stage-video').hidden=true;ui.modal.hidden=true;ui.modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');state.active=null;state.lastFocused?.focus?.(); }
  function setView(view) { closeItem();state.view=view; state.filter='all'; state.sort='shop'; state.query=''; ui.search.value=''; updateControls(); renderItems(); $('shop-content').scrollIntoView({behavior:'smooth'}); }
  function onScroll() {ui.header.classList.toggle('is-scrolled',scrollY>36);}

  function wire() {
    window.addEventListener('scroll',onScroll,{passive:true});onScroll();
    $('brand-link').addEventListener('click',(e)=>{ e.preventDefault();closeItem();state.view='shop';state.filter='all';state.query='';state.sort='shop';ui.search.value='';updateControls();renderItems();window.scrollTo({top:0,behavior:'smooth'}); });
    document.querySelectorAll('.nav-link[data-view]').forEach(x=>x.addEventListener('click',()=>setView(x.dataset.view)));
    $('header-heart').addEventListener('click',()=>setView('favorites'));
    document.querySelectorAll('.category').forEach(x=>x.addEventListener('click',()=>{state.filter=x.dataset.filter;updateControls();renderItems();}));
    $('sort-button').addEventListener('click',()=>{state.sort=state.sort==='shop'?'low':state.sort==='low'?'high':'shop';updateControls();renderItems();});
    ui.search.addEventListener('input',()=>{state.query=ui.search.value.trim().toLowerCase();renderItems();if(state.query)$('shop-content').scrollIntoView({behavior:'smooth',block:'start'});});
    $('mobile-search').addEventListener('click',()=>{const wrap=$('search-wrap');wrap.classList.toggle('is-mobile-open');if(wrap.classList.contains('is-mobile-open'))ui.search.focus();});
    ui.heroInfo.addEventListener('click',()=>{if(state.featured!==null)openItem(state.featured);});
    $('footer-refresh').addEventListener('click',fetchShop);
    $('retry-button').addEventListener('click',fetchShop);
    $('modal-close').addEventListener('click',closeItem);
    ui.modal.addEventListener('click',(e)=>{if(e.target.closest('[data-close="true"]'))closeItem();});
    ui.modalSave.addEventListener('click',()=>{if(state.active!==null)toggleFavorite(state.active);});
    ui.results.addEventListener('click',(e)=>{
      const play=e.target.closest('[data-play]');if(play){e.stopPropagation();playTrack(Number(play.dataset.play));return;}
      const heart=e.target.closest('[data-heart]'); if(heart){e.stopPropagation();toggleFavorite(Number(heart.dataset.heart));return;}
      const nav=e.target.closest('[data-scroll]');if(nav){const track=ui.results.querySelector(`[data-track="${nav.dataset.scroll}"]`);if(track)track.scrollBy({left:Number(nav.dataset.dir)*track.clientWidth*.78,behavior:'smooth'});return;}
      const card=e.target.closest('[data-open]');if(card)openItem(Number(card.dataset.open));
    });
    ui.results.addEventListener('error',(e)=>{const img=e.target;if(!img.matches?.('img.item-art'))return;const fallback=img.dataset.fallbackImage;if(fallback && img.src!==fallback){img.src=fallback;}else{img.style.opacity='0';}},true);
    ui.results.addEventListener('keydown',(e)=>{if(e.target.matches('[data-open]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openItem(Number(e.target.dataset.open));}});
    document.addEventListener('keydown',(e)=>{
      if(e.key==='Escape'){if(!ui.modal.hidden){closeItem();return;}if($('search-wrap').classList.contains('is-mobile-open'))$('search-wrap').classList.remove('is-mobile-open');else if(document.activeElement===ui.search){ui.search.value='';state.query='';renderItems();ui.search.blur();}}
      if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&ui.modal.hidden&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('search-wrap').classList.add('is-mobile-open');ui.search.focus();}
      if(e.key==='Tab'&&!ui.modal.hidden){const focusable=[...ui.modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),summary,iframe')].filter(el=>el.getClientRects().length);if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.live&&state.shopDate&&new Date().toISOString().slice(0,10)!==state.shopDate.slice(0,10))fetchShop();});
  }

  let trackCatalog = null;
  let catalogPromise = null;
  async function loadTrackPreviews() {
    try {
      catalogPromise ||= fetch(TRACKS_URL,{signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error('Preview catalog unavailable');return r.json();});
      trackCatalog = await catalogPromise;
      const activeNeedsPreview=state.active!==null&&itemAt(state.active)?.track&&!itemAt(state.active)?.preview;
      for(const item of state.items){const record=item.track && trackCatalog[item.track.devName];if(record && record.title.toLowerCase()===item.track.title.toLowerCase())item.preview=safeImage(record.previewUrl);}
      renderItems();
      if(activeNeedsPreview&&state.active!==null)renderMedia(itemAt(state.active),true);
    }catch{catalogPromise=null;}
  }
  function playTrack(index,toggle=true) {
    const item=itemAt(index);if(!item?.preview)return;
    const audio=$('track-audio');
    if(toggle&&audio.src===item.preview&&!audio.paused){audio.pause();return;}
    if(audio.src!==item.preview)audio.src=item.preview;
    $('player-title').textContent=item.name;$('player-artist').textContent=item.track?.artist||'';$('player-art').src=item.track?.albumArt||item.image;$('audio-player').hidden=false;
    audio.play().catch(()=>showToast('Preview could not play. Try the play control again.'));
  }
  function renderShowcase(item) {
    $('track-audio').pause();
    const target=ANIMATIONS[item.cosmeticId] ? $('modal-media') : $('stage-showcase');
    if(ANIMATIONS[item.cosmeticId]){
      return;
    }else showStageShowcase(item);
  }
  function showStageShowcase(item){
    const target=$('stage-showcase');target.hidden=false;
    target.innerHTML=`<iframe title="${esc(item.name)} showcase" src="https://www.youtube-nocookie.com/embed/${esc(item.showcase)}?autoplay=1&playsinline=1&controls=0&rel=0&loop=1&playlist=${esc(item.showcase)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    $('modal-media').innerHTML=`<a class="media-note" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v=${esc(item.showcase)}">Open video ↗</a>`;
  }
  function renderMedia(item,autoplay=false) {
    const media=$('modal-media');media.replaceChildren();
    $('stage-showcase').replaceChildren();$('stage-showcase').hidden=true;
    const stage=$('stage-video');stage.pause();stage.removeAttribute('src');stage.hidden=true;
    if(ANIMATIONS[item.cosmeticId]){
      stage.src=ANIMATIONS[item.cosmeticId];stage.hidden=false;stage.muted=item.category!=='emote';stage.controls=false;stage.play().catch(()=>{if(state.active!==item.index||stage.getAttribute('src')!==ANIMATIONS[item.cosmeticId])return;stage.muted=true;stage.play().then(()=>{if(item.category==='emote'&&state.active===item.index){const sound=document.createElement('button');sound.className='preview-sound button button-outline';sound.textContent='Enable sound';sound.onclick=()=>{stage.muted=false;stage.play().catch(()=>{});sound.remove();};media.append(sound);}}).catch(()=>{stage.hidden=true;});});
      stage.onerror=()=>{if(state.active===item.index&&stage.getAttribute('src')===ANIMATIONS[item.cosmeticId])stage.hidden=true;};
    }
    if(item.track){
      media.innerHTML=item.preview?`<button class="button button-primary" id="preview-track">▶ Play preview</button>`:`<p class="media-note">Preview unavailable.</p>`;
      $('preview-track')?.addEventListener('click',()=>playTrack(item.index));
      if(autoplay&&item.preview)playTrack(item.index,false);
    }else if(item.cosmeticId){
      const hasShowcase=/^[\w-]{11}$/.test(item.showcase||'');
      if(hasShowcase)renderShowcase(item);
      else if(!ANIMATIONS[item.cosmeticId])media.innerHTML='<p class="media-note">Loading preview…</p>';
      fetch(`https://fortnite-api.com/v2/cosmetics/br/${encodeURIComponent(item.cosmeticId)}?responseFlags=7`,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(({data})=>{
        if(state.active!==item.index)return;
        Object.assign(item,{history:data.shopHistory||[],variants:data.variants||[],showcase:data.showcaseVideo||item.showcase});renderExtraDetails(item);
        if(/^[\w-]{11}$/.test(item.showcase||'')){
          if(!hasShowcase)renderShowcase(item);
        }else if(!ANIMATIONS[item.cosmeticId])media.innerHTML='<p class="media-note">Preview unavailable.</p>';
      }).catch(()=>{if(state.active===item.index&&!hasShowcase)media.innerHTML='<p class="media-note">Preview unavailable.</p>';});
    }
  }
  function renderExtraDetails(item) {
    const track=item.track;
    const details=[['Section',item.section],['Rarity',item.rarity],['Introduced',item.introduction],['Set',item.set],['Available since',shortDate(item.inDate)],['Leaves shop',shortDate(item.outDate)],['Giftable',typeof item.giftable==='boolean'?(item.giftable?'Yes':'No'):null],['Shop appearances',item.history?.length||null],['Style options',item.variants?.reduce((n,v)=>n+(v.options?.length||0),0)||null],['Artist',track?.artist],['Release year',track?.releaseYear],['Tempo',track?.bpm?`${track.bpm} BPM`:null],['Duration',track?.duration?`${Math.floor(track.duration/60)}:${String(track.duration%60).padStart(2,'0')}`:null]].filter(x=>x[1]);
    ui.modalDetails.innerHTML=details.map(([a,b])=>`<div class="detail-row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
    if(track?.difficulty)ui.modalDetails.innerHTML+=`<div class="difficulty"><h3>Instrument difficulty</h3>${Object.entries(track.difficulty).map(([part,n])=>`<div class="detail-row"><span>${esc(part.replace(/([A-Z])/g,' $1'))}</span><meter min="0" max="6" value="${Math.min(6,Math.max(0,Number(n)||0))}" aria-label="${esc(part)} difficulty ${esc(n)} of 6"></meter><span>${esc(n)} / 6</span></div>`).join('')}</div>`;
    const styles=(item.variants||[]).flatMap(v=>(v.options||[]).map(option=>({...option,channel:v.type||v.channel||'Style'}))).filter(option=>safeImage(option.image));
    if(styles.length){
      const section=document.createElement('details');section.className='style-options';
      section.innerHTML=`<summary>Preview styles · ${styles.length}</summary><div class="style-grid">${styles.map((option,i)=>`<button type="button" data-style="${i}" aria-label="Preview ${esc(option.name||option.tag||'style')}" title="${esc(option.name||option.tag||'Style')}"><img src="${esc(safeImage(option.image))}" loading="lazy" alt=""><span>${esc(option.name||option.tag||'Style')}</span></button>`).join('')}</div>`;
      section.addEventListener('click',e=>{const button=e.target.closest('[data-style]');if(!button)return;const option=styles[Number(button.dataset.style)];$('stage-video').pause();$('stage-video').hidden=true;$('stage-showcase').replaceChildren();$('stage-showcase').hidden=true;ui.modalImage.src=safeImage(option.image);ui.modalImage.alt=`${item.name} — ${option.name||'Style'}`;ui.modalImage.hidden=false;});
      ui.modalDetails.append(section);
    }
    if(item.history?.length){const dates=[...new Set(item.history.map(shortDate).filter(Boolean))].reverse();ui.modalDetails.insertAdjacentHTML('beforeend',`<details class="shop-history"><summary>Shop history · ${dates.length} days</summary><p>${dates.map(esc).join(' · ')}</p></details>`);}
  }
  $('player-close').addEventListener('click',()=>{$('track-audio').pause();$('track-audio').removeAttribute('src');$('track-audio').load();$('audio-player').hidden=true;});
  window.ashlanShop = {
    hasAnimation:id=>Boolean(ANIMATIONS[id]),
    current:()=>itemAt(state.active),
    items:()=>state.items,
    refresh:renderItems,
    openOffer:id=>{const item=state.items.find(x=>x.id===id);if(item)openItem(item.index);},
    openSnapshot:item=>{const current=state.items.find(x=>x.id===item.id);if(current){openItem(current.index);return;}const index=-(libraryItems.size+1);libraryItems.set(index,{...item,index});openItem(index);},
    openCosmetic(raw,kind='br') {
      const id='cosmetic-'+kind+'-'+raw.id;
      let item=[...libraryItems.values()].find(x=>x.id===id);
      if(!item){
        const entry = {[kind==='br'?'brItems':kind==='tracks'?'tracks':kind==='cars'?'cars':kind==='instruments'?'instruments':'brItems']:[raw]};
        item=normalize(entry,-(libraryItems.size+1),state.shopDate);
        Object.assign(item,{id,catalog:true,section:'Cosmetic Library',name:raw.name||raw.title||raw.id,cosmeticId:kind==='br'?raw.id:null,isNew:false,availability:raw.shopHistory?.length?'Previously in shop':'Availability unconfirmed'});
        item.search=`${item.name} ${item.typeLabel} ${item.description}`.toLowerCase();
        const offer=state.items.find(x=>x.cosmeticId===raw.id||x.track?.id===raw.id);
        if(offer){item.availability='In today’s shop';item.price=offer.price;}
        if(item.track&&trackCatalog)item.preview=safeImage(trackCatalog[item.track.devName]?.previewUrl);
        libraryItems.set(item.index,item);
      }
      openItem(item.index);
    },
    isSaved:(kind,id)=>state.favorites.has('cosmetic-'+kind+'-'+id),
    inShop:id=>state.items.some(x=>x.cosmeticId===id||x.track?.id===id),
    close:closeItem
  };
  $('share-item').addEventListener('click',async()=>{const item=itemAt(state.active);if(!item)return;const url=new URL(location.href);url.hash=(item.catalog?'cosmetic=':'item=')+encodeURIComponent(item.id);try{await navigator.clipboard.writeText(url.href);showToast('Item link copied');}catch{showToast('Copy this page URL to share');history.replaceState(null,'',url);}});

  function refreshFilterOptions(){
    for(const field of ['section','rarity']){const select=$('filter-'+field);const values=[...new Set(state.items.map(i=>i[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));const signature=values.join('|');if(select.dataset.options===signature)continue;select.dataset.options=signature;select.innerHTML=`<option value="">${field==='section'?'All sections':'All rarities'}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');select.value=state.advanced[field];}
  }
  function resetFilters(){state.filter='all';state.query='';state.sort='shop';ui.search.value='';Object.keys(state.advanced).forEach(k=>{state.advanced[k]='';$('filter-'+k).value='';});updateControls();renderItems();}
  for(const field of Object.keys(state.advanced))$('filter-'+field).onchange=e=>{state.advanced[field]=e.target.value;renderItems();};
  $('filter-sort').onchange=e=>{state.sort=e.target.value;updateControls();renderItems();};$('reset-filters').onclick=resetFilters;
  const trackAudio=$('track-audio');
  const timeLabel=n=>Number.isFinite(n)?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`:'0:00';
  function updatePlayer(){
    const playing=!trackAudio.paused&&!trackAudio.ended;
    $('player-toggle').setAttribute('aria-label',playing?'Pause preview':'Play preview');
    $('player-toggle').innerHTML=playing?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>';
    const progress=Number.isFinite(trackAudio.duration)&&trackAudio.duration>0?trackAudio.currentTime/trackAudio.duration*100:0;
    $('player-seek').disabled=!Number.isFinite(trackAudio.duration);$('player-seek').value=progress;$('player-seek').style.setProperty('--progress',progress+'%');
    $('player-elapsed').textContent=timeLabel(trackAudio.currentTime);$('player-duration').textContent=timeLabel(trackAudio.duration);
    const muted=trackAudio.muted||trackAudio.volume===0;$('player-mute').classList.toggle('is-muted',muted);$('player-mute').setAttribute('aria-label',muted?'Unmute preview':'Mute preview');$('player-mute').setAttribute('aria-pressed',String(muted));
    $('player-volume').value=trackAudio.muted?0:trackAudio.volume;$('player-volume').style.setProperty('--progress',(trackAudio.muted?0:trackAudio.volume*100)+'%');
  }
  ['play','pause','ended','loadedmetadata','durationchange','timeupdate','volumechange','emptied'].forEach(event=>trackAudio.addEventListener(event,updatePlayer));
  $('player-toggle').onclick=()=>{if(trackAudio.paused)trackAudio.play().catch(()=>showToast('Preview unavailable. Try another track.'));else trackAudio.pause();};
  $('player-seek').oninput=e=>{if(Number.isFinite(trackAudio.duration))trackAudio.currentTime=Number(e.target.value)/100*trackAudio.duration;updatePlayer();};
  $('player-mute').onclick=()=>{trackAudio.muted=!(trackAudio.muted||trackAudio.volume===0);if(!trackAudio.muted&&trackAudio.volume===0)trackAudio.volume=1;};
  $('player-volume').oninput=e=>{trackAudio.volume=Number(e.target.value);trackAudio.muted=false;};
  updatePlayer();

  readFavorites();wire();updateCountdown();setInterval(updateCountdown,1000);fetchShop().then(()=>{if(location.hash.startsWith('#item=')){const id=decodeURIComponent(location.hash.slice(6));const item=state.items.find(x=>x.id===id);if(item)openItem(item.index);}window.dispatchEvent(new Event('ashlan-shop-ready'));});
  if(!new URLSearchParams(location.search).has('embed')&&'serviceWorker' in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

})();
