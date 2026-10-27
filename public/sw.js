// Vela owns only its scoped shell cache. Private API/media responses bypass it.
const VERSION='pwa-repair-20261027';
const PREFIX='vela-shell-';
const CACHE=PREFIX+VERSION;
const ROOT=new URL('./',self.registration.scope).href;
const PRECACHE=/* VELA_PRECACHE */['./','./manifest.webmanifest','./favicon.svg','./vela-mark.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT)||url.pathname.includes('/api/')||url.pathname.includes('/media/')||url.searchParams.has('ticket')||request.headers.has('Authorization'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{const response=await fetch(request,{signal:AbortSignal.timeout(8000)});if(response.ok&&response.headers.get('content-type')?.includes('text/html')){await cache.put(ROOT,response.clone());return response;}return await cache.match(ROOT,{ignoreVary:true})||response;}
   catch{return await cache.match(ROOT,{ignoreVary:true})||new Response('Vela is offline. Reconnect and reopen the app.',{status:503,headers:{'Content-Type':'text/plain'}});}
  })());return;
 }
 if(!/\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),cached=await cache.match(request,{ignoreVary:true});if(cached)return cached;
  const response=await fetch(request);
  // Never turn an HTML fallback into a cached JavaScript module.
  if(response.ok&&response.type!=='opaque'&&!response.headers.get('content-type')?.includes('text/html'))event.waitUntil(cache.put(request,response.clone()).then(async()=>{const keys=await cache.keys();const runtime=keys.filter(key=>!PRECACHE.some(path=>new URL(path,ROOT).href===key.url));if(runtime.length>180)await Promise.all(runtime.slice(0,runtime.length-180).map(key=>cache.delete(key)));}).catch(()=>{}));
  return response;
 })());
});
