import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Info,
  Menu,
  Play,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from './api';
import { sendLargeFile, type UploadProvider } from './large-upload';
import {
  animals,
  exhibits,
  logoUrl,
  officialAnimals,
  officialExhibits,
  formatCount,
  type Animal,
} from './data';

type Media = {
  id: string;
  name: string;
  kind: 'image' | 'video';
  mime: string;
  animal: string;
  exhibit: string;
  caption: string;
  url: string;
  createdAt: number;
  size: number;
};
type QueueItem = {
  id: string;
  file: File;
  status: 'waiting' | 'uploading' | 'done' | 'failed';
  animal: string;
  message: string;
  preview?: string;
  progress?: number;
};
const label = (a: string) => animals.find(x => x.id === a)?.name || 'Unsorted';
const toBase64 = (f: File | Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Cannot read file'));
    r.readAsDataURL(f);
  });
const resolveHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('animal/'))
    return { page: 'animal', id: decodeURIComponent(hash.slice(7)) };
  if (hash.startsWith('exhibit/'))
    return { page: 'exhibit', id: decodeURIComponent(hash.slice(8)) };
  return {
    page:
      hash === 'media'
        ? 'media'
        : hash === 'upload'
          ? 'upload'
          : hash === 'exhibits'
            ? 'exhibits'
            : 'home',
    id: '',
  };
};
const dateText = (n: number) =>
  new Date(n).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
function App() {
  const [route, setRoute] = useState(resolveHash);
  const [ownerKey] = useState(()=>{
    try{
      const hash=window.location.hash;
      if(hash.startsWith('#owner=')){
        const key=decodeURIComponent(hash.slice(7));
        if(/^[a-zA-Z0-9_-]{32,128}$/.test(key)){
          localStorage.setItem('newport-archive-owner-link',key);
          window.history.replaceState(null,'',window.location.pathname+window.location.search);
          return key;
        }
      }
      return localStorage.getItem('newport-archive-owner-link') || localStorage.getItem('newport-archive-owner-v1') || '';
    }catch{return '';}
  });
  const [media, setMedia] = useState<Media[]>([]);
  const [nextToken, setNextToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Media | null>(null);
  const [admin, setAdmin] = useState(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [providers, setProviders] = useState<{r2:boolean;b2:boolean}>({r2:false,b2:false});
  const [uploadProvider, setUploadProvider] = useState<UploadProvider>('r2');
  const [editing, setEditing] = useState('');
  const [editAnimal, setEditAnimal] = useState('unidentified');
  const [editCaption, setEditCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const quickPickRef = useRef<HTMLInputElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [mediaMode, setMediaMode] = useState<'all' | 'image' | 'video' | 'unsorted'>('all');
  const nav = useCallback((path: string) => {
    window.location.hash = path;
    setMenuOpen(false);
    setSearch('');
  }, []);
  useEffect(() => {
    const fn = () => {
      setRoute(resolveHash());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  useEffect(()=>{
    if(!ownerKey)return;
    let active=true;
    api.post('/api/admin/check',{ownerKey}).then(()=>{if(active)setAdmin(true);})
      .catch(()=>{if(active)setAdmin(false);});
    return ()=>{active=false;};
  },[ownerKey]);
  useEffect(()=>{
    let active=true;
    api.get('/api/large/status').then(r=>{
      if(!active)return;
      const p=r.data.providers||{};
      setProviders({r2:Boolean(p.r2),b2:Boolean(p.b2)});
      if(!p.r2&&p.b2)setUploadProvider('b2');
    }).catch(()=>{if(active)setProviders({r2:false,b2:false});});
    return ()=>{active=false;};
  },[]);
  const loadMedia = useCallback(async (append = false, token = '') => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const response = await api.get(
        '/api/media' + (token ? '?nextToken=' + encodeURIComponent(token) : '')
      );
      const values = (response.data?.items || []) as Media[];
      setMedia(old =>
        append
          ? [...old, ...values.filter(x => !old.some(y => y.id === x.id))]
          : values
      );
      setNextToken(String(response.data?.nextToken || ''));
      setError('');
    } catch {
      setError('The gallery could not be loaded.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);
  useEffect(() => {
    loadMedia();
  }, [loadMedia]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
        setEditing('');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const visibleMedia = media;

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    visibleMedia.forEach(x => {
      out[x.animal] = (out[x.animal] || 0) + 1;
    });
    return out;
  }, [media]);
  const filteredAnimals = animals.filter(a =>
    (a.name + ' ' + a.exhibit + ' ' + a.scientific)
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const filteredExhibits = exhibits.filter(a =>
    (a.name + ' ' + a.subtitle).toLowerCase().includes(search.toLowerCase())
  );
  const matchMedia = (list: Media[]) =>
    list
      .filter(x => mediaMode === 'all' || (mediaMode === 'unsorted' ? x.animal === 'unidentified' : x.kind === mediaMode))
      .filter(
        x =>
          !search ||
          (x.name + ' ' + label(x.animal) + ' ' + x.exhibit + ' ' + x.caption)
            .toLowerCase()
            .includes(search.toLowerCase())
      );
  const animal =
    route.page === 'animal' ? animals.find(x => x.id === route.id) : undefined;
  const exhibit =
    route.page === 'exhibit'
      ? exhibits.find(x => x.id === route.id)
      : undefined;
  const imgFor = (a: Animal) => a.image;
  function stageFiles(files: FileList | File[] | null) {
    if (!files) return;
    const next = Array.from(files)
      .filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || /\.(mov|mp4|webm|jpg|jpeg|png|gif|webp)$/i.test(f.name))
      .sort((a, b) => a.size - b.size || a.name.localeCompare(b.name))
      .map((file, i) => ({
        id: Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 7),
        file,
        progress: 0,
        status: 'waiting' as const,
        animal: 'unidentified',
        message: '',
        preview: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
      }));
    if(next.length){
      setQueue(q => {
        const combined = [...q, ...next];
        const waiting = combined.filter(item => item.status === 'waiting')
          .sort((a, b) => a.file.size - b.file.size || a.file.name.localeCompare(b.file.name));
        return [...combined.filter(item => item.status !== 'waiting'), ...waiting];
      });
      nav('upload');
    }
  }
  async function uploadQueue() {
    if(uploadBusy||!queue.some(x=>x.status==='waiting'||x.status==='failed'))return;
    if(!providers.r2&&!providers.b2 && queue.some(x=>(x.status==='waiting'||x.status==='failed')&&x.file.size>3000000)){
      setError('Connect R2 or B2 storage for large uploads. The website cannot hold your gigabytes of media by itself.');
      return;
    }
    setError('');
    setUploadBusy(true);
    // Finish the smallest media first, so the gallery populates quickly.
    for(const item of queue.filter(x=>x.status==='waiting'||x.status==='failed')
      .sort((a,b)=>a.file.size-b.file.size||a.file.name.localeCompare(b.file.name))){
      const change=(patch:Partial<QueueItem>)=>setQueue(q=>q.map(x=>x.id===item.id?{...x,...patch}:x));
      const mime=item.file.type || (item.file.name.toLowerCase().endsWith('.mov')?'video/quicktime':'');
      if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','video/x-m4v'].includes(mime)){
        change({status:'failed',message:'Unsupported file. Choose JPG, PNG, MP4, MOV or WebM.'});continue;
      }
      const animalId = 'unidentified';
      try {
        change({status:'uploading',message:'Uploading',progress:0});
        if(providers.r2||providers.b2){
          await sendLargeFile(item.file,uploadProvider,animalId,(pct,message)=>change({status:'uploading',message,progress:pct}),ownerKey);
        }else{
          const data=await toBase64(item.file);
          await api.post('/api/upload',{name:item.file.name,mime,data,animal:animalId,size:item.file.size,ownerKey});
        }
        change({status:'done',animal:animalId,progress:100,message:'Published'});
      }catch(e){
        const message=(e as {response?:{data?:{error?:string}}})?.response?.data?.error || (e instanceof Error?e.message:'Upload failed');
        change({status:'failed',message});
      }
    }
    setUploadBusy(false);
    await loadMedia();
  }
  useEffect(()=>{
    if(!uploadBusy && queue.some(q=>q.status==='waiting')){
      void uploadQueue();
    }
  },[admin,uploadBusy,queue,providers.r2,providers.b2]);
  async function saveEdit(m: Media) {
    setSaving(true);
    try {
      await api.put('/api/media/' + encodeURIComponent(m.id), {
        animal: editAnimal,
        caption: editCaption,
        ownerKey,
      });
      setMedia(old =>
        old.map(x =>
          x.id === m.id
            ? {
                ...x,
                animal: editAnimal,
                exhibit: animals.find(a => a.id === editAnimal)?.exhibit || '',
                caption: editCaption,
              }
            : x
        )
      );
      setEditing('');
      setSelected(null);
    } catch {
      setError('Could not save this change.');
    } finally {
      setSaving(false);
    }
  }
  async function deleteMedia(m: Media) {
    if (!window.confirm('Delete this photo or video permanently?')) return;
    try {
      await api.post('/api/media/' + encodeURIComponent(m.id) + '/delete',{ownerKey});
      setMedia(old => old.filter(x => x.id !== m.id));
      setSelected(null);
      setEditing('');
    } catch {
      setError('Could not delete this file.');
    }
  }
  function openEdit(m: Media) {
    setEditing(m.id);
    setEditAnimal(m.animal);
    setEditCaption(m.caption || '');
  }
  const mediaTiles = (items: Media[]) =>
    items.length === 0 ? (
      <div className="empty-state">
        <ImageIcon size={32} />
        <h3>No uploads here yet</h3>
        <p>Photos and videos added to this collection will appear here.</p>
      </div>
    ) : (
      <div className="media-grid">
        {items.map(m => (
          <button
            className="media-tile"
            key={m.id}
            onClick={() => setSelected(m)}
            aria-label={'Open ' + m.name}
          >
            {m.kind === 'image' ? (
              <img src={m.url} alt={m.caption || m.name} loading="lazy" />
            ) : (
              <div className="video-thumb">
                <video src={m.url} muted preload="metadata" playsInline />
                <span className="play-overlay">
                  <Play size={24} fill="currentColor" />
                </span>
              </div>
            )}
            <div className="media-meta">
              <span>{m.caption || label(m.animal)}</span>
              <span>
                {m.kind === 'video' ? (
                  <Film size={14} />
                ) : (
                  <ImageIcon size={14} />
                )}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  return (
    <div className="app-shell" ref={pageRef}>
      <header className="header">
        <button className="brand" onClick={() => nav('')} aria-label="Home">
          <img src={logoUrl} alt="Newport Aquarium logo" />
          <span className="brand-separator" />
          <span className="brand-title">
            VISITOR ARCHIVE<span>UNOFFICIAL GALLERY</span>
          </span>
        </button>
        <nav className={'nav ' + (menuOpen ? 'show' : '')}>
          <button
            className={['home', 'animal'].includes(route.page) ? 'active' : ''}
            onClick={() => nav('')}
          >
            Animals
          </button>
          <button
            className={
              ['exhibits', 'exhibit'].includes(route.page) ? 'active' : ''
            }
            onClick={() => nav('exhibits')}
          >
            Exhibits
          </button>
          <button
            className={route.page === 'media' ? 'active' : ''}
            onClick={() => nav('media')}
          >
            All Media
          </button>
        </nav>
        <div className="header-actions">
          <input
            ref={quickPickRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov,.m4v"
            style={{display:'none'}}
            onChange={e=>{stageFiles(e.target.files);e.target.value='';}}
            aria-label="Choose media to add"
          />
          <button className="upload-button" onClick={() => quickPickRef.current?.click()}>
            <UploadCloud size={17} /> <span>Add</span>
          </button>
          <button
            className="mobile-menu"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      {route.page === 'home' && (
        <>

          <section className="hero">
            <div className="hero-img" role="img" aria-label="Newport Aquarium jellyfish exhibit photograph" />
            <div className="hero-content">
              <div className="eyebrow">NEWPORT AQUARIUM / VISITOR GALLERY</div>
              <h1>Photos &amp;<br /><em>videos.</em></h1>
              <p>Browse animals, identify species, and see photos and videos from the aquarium.</p>
              <div className="hero-actions">
                <button className="primary-action" onClick={() => document.getElementById('species')?.scrollIntoView({ behavior: 'smooth' })}>
                  Browse species <ArrowRight size={17} />
                </button>
                <button className="secondary-action" onClick={() => nav('media')}>All media</button>
              </div>
            </div>
            <div className="hero-credit">NEWPORT AQUARIUM / JELLIES EXHIBIT</div>
          </section>
          <section className="section wrap" id="species">
            <div className="section-head">
              <div>
                <div className="eyebrow muted">BROWSE BY SPECIES</div>
                <h2>
                  Animals
                </h2>
                <p>Choose a species to view its media.</p>
              </div>
              <div className="search-field">
                <Search size={18} />
                <input
                  aria-label="Search animals"
                  placeholder="Search animals..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="animal-collections">
              {['Jellyfish', 'Penguins', 'Marine life', 'Reptiles & amphibians'].map(group => {
                const members = filteredAnimals.filter(a => a.group === group);
                return members.length ? (
                  <div className="animal-section" key={group}>
                    <div className="group-label">
                      <h3>{group}</h3>
                      <span>{members.length} species / groups</span>
                    </div>
                    <div className="animal-grid">
                      {members.map((a, i) => (
                        <button className="animal-card" key={a.id} onClick={() => nav('animal/' + a.id)} style={{ animationDelay: Math.min(i, 6) * 30 + 'ms' }}>
                          <div className="animal-image">
                            <img src={imgFor(a)} alt={a.name + ' reference image'} loading="lazy" />
                            <span className="animal-arrow"><ArrowRight size={18} /></span>
                          </div>
                          <div className="animal-info">
                            <div><h3>{a.name}</h3><p>{a.scientific}</p></div>
                            <span className="count">{counts[a.id] || 0}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
            {filteredAnimals.length === 0 && (
              <div className="empty-state">
                <Search size={30} />
                <h3>No matching animals</h3>
                <p>Try another name.</p>
              </div>
            )}
          </section>
        </>
      )}

      {route.page === 'exhibits' && (
        <main className="wrap page-pad">
          <div className="page-top">
            <div className="eyebrow muted">EXHIBIT INDEX</div>
            <h1 className="page-title">
              Exhibits<span className="dot-title">.</span>
            </h1>
            <p>Species grouped by where they were photographed.</p>
          </div>
          <div className="search-field page-search">
            <Search size={18} />
            <input
              aria-label="Search exhibits"
              placeholder="Search exhibits..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="exhibit-grid">
            {filteredExhibits.map(e => (
              <button
                className="exhibit-card"
                key={e.id}
                onClick={() => nav('exhibit/' + e.id)}
              >
                <img
                  src={e.image}
                  alt={e.name + ' reference habitat'}
                  loading="lazy"
                />
                <div className="exhibit-shade" />
                <div className="exhibit-text">
                  <span>{e.subtitle}</span>
                  <h3>{e.name}</h3>
                </div>
                <span className="round-arrow">
                  <ArrowRight size={19} />
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {animal && (
        <main className="detail-page">
          <div className="detail-hero">
            <img
              src={animal.image}
              alt={animal.name + ' reference photograph'}
            />
            <div className="detail-wash" />
            <div className="wrap detail-inner">
              <button className="back-link" onClick={() => nav('')}>
                <ArrowLeft size={17} /> All animals
              </button>
              <div className="detail-content">
                <div className="eyebrow">{animal.exhibit}</div>
                <h1>
                  {animal.name}
                  <span className="dot-title">.</span>
                </h1>
                <div className="scientific">{animal.scientific}</div>
                <p>{animal.summary}</p>
                <div className="detail-buttons">
                  <button
                    onClick={() =>
                      nav(
                        'exhibit/' +
                          (exhibits.find(x => x.name === animal.exhibit)?.id ||
                            'surrounded-by-sharks')
                      )
                    }
                  >
                    Explore exhibit <ArrowRight size={17} />
                  </button>
                  <a href={officialAnimals} target="_blank" rel="noreferrer">
                    Official animal guide <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            </div>
            <span className="detail-credit">
              REFERENCE IMAGE · {animal.credit}
            </span>
          </div>
          <section className="wrap detail-gallery">
            <div className="section-head compact">
              <div>
                <div className="eyebrow muted">THE ARCHIVE</div>
                <h2>Photos &amp; videos</h2>
                <p>
                  {formatCount(
                    visibleMedia.filter(x => x.animal === animal.id).length,
                    'capture',
                    'captures'
                  )}{' '}
                  in this collection
                </p>
              </div>
            </div>
            {mediaTiles(visibleMedia.filter(x => x.animal === animal.id))}
          </section>
        </main>
      )}

      {route.page === 'animal' && !animal && (
        <main className="wrap not-found">
          <h1>Animal not found</h1>
          <button className="primary-action" onClick={() => nav('')}>
            All animals <ArrowRight size={17} />
          </button>
        </main>
      )}

      {exhibit && (
        <main className="detail-page">
          <div className="detail-hero">
            <img
              src={exhibit.image}
              alt={exhibit.name + ' reference photograph'}
            />
            <div className="detail-wash" />
            <div className="wrap detail-inner">
              <button className="back-link" onClick={() => nav('exhibits')}>
                <ArrowLeft size={17} /> All exhibits
              </button>
              <div className="detail-content">
                <div className="eyebrow">NEWPORT AQUARIUM · EXHIBIT</div>
                <h1>
                  {exhibit.name}
                  <span className="dot-title">.</span>
                </h1>
                <p>{exhibit.subtitle}</p>
                <div className="detail-buttons">
                  <a href={officialExhibits} target="_blank" rel="noreferrer">
                    Official exhibit guide <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
            <span className="detail-credit">SPECIES REFERENCE PHOTOGRAPH</span>
          </div>
          <section className="wrap detail-gallery">
            <div className="section-head compact">
              <div>
                <div className="eyebrow muted">FOUND HERE</div>
                <h2>Animals in this exhibit</h2>
              </div>
            </div>
            <div className="mini-animal-grid">
              {animals
                .filter(x => x.exhibit === exhibit.name)
                .map(a => (
                  <button
                    key={a.id}
                    className="mini-animal"
                    onClick={() => nav('animal/' + a.id)}
                  >
                    <img src={a.image} alt={a.name} />
                    <span>{a.name}</span>
                    <ArrowRight size={16} />
                  </button>
                ))}
            </div>
            <div className="section-head compact space-top">
              <div>
                <h2>Photos &amp; videos</h2>
                <p>
                  {formatCount(
                    visibleMedia.filter(x => x.exhibit === exhibit.name).length,
                    'capture',
                    'captures'
                  )}{' '}
                  in this exhibit
                </p>
              </div>
            </div>
            {mediaTiles(visibleMedia.filter(x => x.exhibit === exhibit.name))}
          </section>
        </main>
      )}

      {route.page === 'exhibit' && !exhibit && (
        <main className="wrap not-found">
          <h1>Exhibit not found</h1>
          <button className="primary-action" onClick={() => nav('exhibits')}>
            All exhibits <ArrowRight size={17} />
          </button>
        </main>
      )}

      {route.page === 'media' && (
        <main className="wrap page-pad">
          <div className="page-top">
            <div className="eyebrow muted">VISITOR ARCHIVE</div>
            <h1 className="page-title">
              All media<span className="dot-title">.</span>
            </h1>
            <p>Photos and videos from visitors.</p>
          </div>
          <div className="filters">
            <div className="segmented">
              {(['all', 'image', 'video', 'unsorted'] as const).map(x => (
                <button
                  key={x}
                  className={mediaMode === x ? 'selected' : ''}
                  onClick={() => setMediaMode(x)}
                >
                  {x === 'all'
                    ? 'All media'
                    : x === 'image'
                      ? 'Photos'
                      : x === 'unsorted'
                        ? 'Unsorted (' + visibleMedia.filter(m => m.animal === 'unidentified').length + ')'
                        : 'Videos'}
                </button>
              ))}
            </div>
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Search media"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search the gallery..."
              />
            </div>
          </div>
          {loading ? (
            <div className="status">Loading gallery...</div>
          ) : (
            mediaTiles(matchMedia(visibleMedia))
          )}
          {error && (
            <div className="alert">
              {error} <button onClick={() => loadMedia()}>Retry</button>
            </div>
          )}
          {nextToken && (
            <button
              className="load-more"
              disabled={loadingMore}
              onClick={() => loadMedia(true, nextToken)}
            >
              {loadingMore ? 'Loading...' : 'Load more media'}{' '}
              <ArrowRight size={16} />
            </button>
          )}
        </main>
      )}

      {route.page === 'upload' && (
        <main className="wrap page-pad upload-page">
          <div className="page-top">
            <div className="eyebrow muted">ADD TO COLLECTION</div>
            <h1 className="page-title">
              Add photos &amp; videos<span className="dot-title">.</span>
            </h1>
            <p>
              Choose your files. Smallest files upload first. Assign animals afterward.
            </p>
          </div>
          <>
              {error&&<div className="alert">{error}</div>}
              <div className="upload-layout">
                <div className="upload-main">
                  <div
                    className="drop-area"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      stageFiles(e.dataTransfer.files);
                    }}
                    onClick={() => inputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') inputRef.current?.click();
                    }}
                  >
                    <div className="drop-icon">
                      <UploadCloud size={31} />
                    </div>
                    <h2>Choose photos and videos</h2>
                    <p>Select multiple files or drop them here. Smallest files upload first.</p>
                    <span>JPG, PNG, WebP, GIF, MP4, MOV, WebM</span>
                    <input
                      ref={inputRef}
                      aria-label="Choose photos and videos"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov,.m4v"
                      onChange={e => {
                        stageFiles(e.target.files);
                        e.target.value = '';
                      }}
                      hidden
                    />
                  </div>

                  <div className="large-upload-status">
                    {(providers.r2||providers.b2) ? (
                      <>
                        <strong className="ready"><Check size={17}/> Large-file uploads connected</strong>
                        <p>Files up to 100 GB each. Direct 16 MB chunked uploads with progress, retries and resume by reselecting the same file.</p>
                        {providers.r2&&providers.b2&&(
                          <label>Upload destination
                            <select value={uploadProvider} onChange={e=>setUploadProvider(e.target.value as UploadProvider)}>
                              <option value="r2">Cloudflare R2</option>
                              <option value="b2">Backblaze B2</option>
                            </select>
                          </label>
                        )}
                        <small>For widest video playback support, use MP4 encoded as H.264. MOV originals may not play in every browser.</small>
                      </>
                    ) : (
                      <>
                        <strong><Info size={17}/> Large-file storage needs connecting</strong>
                        <p>You can queue your full 10–20 GB collection, but publishing large videos needs a connected R2 or B2 bucket. This connection is not active yet. Small files under 3 MB can still use the temporary storage.</p>
                        <a href="https://dash.cloudflare.com/?to=/:account/r2/overview" target="_blank" rel="noreferrer">Cloudflare R2 setup <ExternalLink size={14}/></a>
                        <small>R2 includes 10 GB of free storage. B2 has a separate 10 GB free tier. Usage and download limits apply.</small>
                      </>
                    )}
                  </div>
                  {queue.length > 0 && (
                    <section className="queue-panel">
                      <div className="queue-head">
                        <h3>
                          Upload queue <span>{queue.length}</span>
                        </h3>
                        <span className="upload-order-note">Smallest files first</span>
                        <button
                          disabled={uploadBusy}
                          onClick={() => setQueue([])}
                        >
                          Clear completed / queue
                        </button>
                      </div>
                      <div className="queue-list">
                        {queue.map(q => (
                          <div className="queue-item" key={q.id}>
                            <div className="queue-preview">
                              {q.preview ? (
                                <img src={q.preview} alt="Upload preview" />
                              ) : (
                                <Film size={23} />
                              )}
                            </div>
                            <div className="queue-text">
                              <strong title={q.file.name}>{q.file.name}</strong>
                              <small>
                                {q.file.size>=1073741824?(q.file.size/1073741824).toFixed(2)+' GB':(q.file.size/1048576).toFixed(1)+' MB'} ·{' '}
                                {q.message || label(q.animal)}
                              </small>
                              {(q.status==='uploading'||q.status==='done')&&(
                                <div className="file-progress"><span style={{width:(q.progress||0)+'%'}}/></div>
                              )}
                            </div>
                            <span className={'queue-status ' + q.status}>
                              {q.status === 'done' ? (
                                <Check size={17} />
                              ) : q.status === 'failed' ? (
                                'Failed'
                              ) : q.status === 'waiting' ? (
                                'Queued'
                              ) : (
                                'Working'
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                      {queue.some(x => x.status === 'failed') && !uploadBusy && (
                        <button className="start-upload" onClick={uploadQueue}>
                          Retry failed uploads <ArrowRight size={18} />
                        </button>
                      )}
                    </section>
                  )}
                </div>
                <aside className="upload-side">
                  <div className="settings-card">
                     <div className="settings-title">
                       <SlidersHorizontal size={18} />
                       <h3>Upload now, sort later</h3>
                     </div>
                     <p className="settings-hint">All photos and videos upload as Unsorted. Assign animals and edit captions after they're published.</p>
                   </div>
                   <div className="settings-card compact-card">
                    <h3>Public gallery</h3>
                    <p>
                      New uploads appear immediately as Unsorted. Review photos and assign each animal whenever you're ready.
                    </p>
                    <button className="aside-link" onClick={() => nav('media')}>
                      Browse uploaded media <ArrowRight size={16} />
                    </button>
                  </div>
                </aside>
              </div>
              {media.length > 0 && (
                <div className="manage-block">
                  <div className="section-head compact">
                    <div>
                      <div className="eyebrow muted">MANAGE</div>
                      <h2>Edit existing uploads</h2>
                    </div>
                  </div>
                  <div className="manage-grid">
                    {media.map(m => (
                      <div className="manage-row" key={m.id}>
                        <div className="manage-icon">
                          {m.kind === 'image' ? (
                            <img src={m.url} alt="" />
                          ) : (
                            <Film />
                          )}
                        </div>
                        <div className="manage-copy">
                          <strong>{m.name}</strong>
                          <span>
                            {label(m.animal)} · {dateText(m.createdAt)}
                          </span>
                        </div>
                        <button onClick={() => openEdit(m)}>
                          Edit <ArrowRight size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      )}

      <footer className="footer">
        <div className="wrap footer-inner">
          <div>
            <div className="footer-title">
              Newport Aquarium <span>Visitor Archive</span>
            </div>
            <p>
              Independent visitor photo collection. Not affiliated with or
              endorsed by Newport Aquarium.
            </p>
          </div>
          <div className="footer-links">
            <a
              href="https://www.newportaquarium.com/"
              target="_blank"
              rel="noreferrer"
            >
              Official aquarium <ExternalLink size={13} />
            </a>
            <a href={officialAnimals} target="_blank" rel="noreferrer">
              Animal information <ExternalLink size={13} />
            </a>
            <button onClick={() => nav('upload')}>Owner uploads</button>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>
            REFERENCE ANIMAL PHOTOS ARE NOT VISITOR UPLOADS OR NECESSARILY TAKEN
            AT NEWPORT AQUARIUM.
          </span>
          <span>© VISITOR ARCHIVE</span>
        </div>
      </footer>

      {selected && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Media viewer"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="lightbox-bar">
            <button onClick={() => setSelected(null)}>
              <X size={20} /> Close
            </button>
            <span>
              {label(selected.animal)} · {dateText(selected.createdAt)}
            </span>
          </div>
          <div className="lightbox-center">
            {selected.kind === 'image' ? (
              <img src={selected.url} alt={selected.caption || selected.name} />
            ) : (
              <video src={selected.url} controls playsInline autoPlay />
            )}
          </div>
          <div className="lightbox-footer">
            <div>
              <strong>{selected.caption || selected.name}</strong>
              <small>{selected.exhibit || 'Unsorted'}</small>
            </div>
            {admin && selected.id !== 'visitor-jellies-20261107' && (
              <button onClick={() => openEdit(selected)}>
                Edit details <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
      {editing &&
        admin &&
        (() => {
          const current = media.find(x => x.id === editing);
          return current ? (
            <div
              className="modal-scrim"
              onMouseDown={e => {
                if (e.target === e.currentTarget) setEditing('');
              }}
            >
              <div className="edit-modal">
                <div className="modal-head">
                  <div>
                    <div className="eyebrow muted">EDIT DETAILS</div>
                    <h2>Organize capture</h2>
                  </div>
                  <button
                    aria-label="Close edit"
                    onClick={() => setEditing('')}
                  >
                    <X size={21} />
                  </button>
                </div>
                <p className="edit-filename">{current.name}</p>
                <label>
                  Animal
                  <select
                    value={editAnimal}
                    onChange={e => setEditAnimal(e.target.value)}
                  >
                    <option value="unidentified">Unsorted</option>
                    {animals.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Caption
                  <textarea
                    value={editCaption}
                    onChange={e => setEditCaption(e.target.value)}
                    rows={3}
                    placeholder="Optional caption"
                  />
                </label>
                <div className="modal-actions">
                  <button
                    className="danger"
                    onClick={() => deleteMedia(current)}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                  <button
                    className="primary-action"
                    onClick={() => saveEdit(current)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save changes'} <Check size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : null;
        })()}
    </div>
  );
}
export default App;
