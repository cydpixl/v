// Vela owns only its scoped shell cache. Private API/media responses bypass it.
const VERSION='pwa-f33c216aaef8';
const PREFIX='vela-shell-';
const CACHE=PREFIX+VERSION;
const ROOT=new URL('./',self.registration.scope).href;
const PRECACHE=["./","./manifest.webmanifest","./favicon.svg","./vela-mark.svg","./icons/icon-192.png","./icons/icon-512.png","./icons/apple-touch-icon.png","./icons/maskable-512.png","./vela-smtc.js?v=compact-shell-20261101","./vela-smtc.css","./fonts/gg-sans-400.woff2","./fonts/gg-sans-500.woff2","./fonts/gg-sans-600.woff2","./fonts/gg-sans-700.woff2","./assets/hls.worker-DX51GcGk.js","./assets/index-JZ9JY_I7.css","./assets/cinema-app-BnHafZOA.css","./assets/youtube-app-CFCJJUkI.css","./assets/nova-app-CC5u5CAC.css","./assets/workspace-apps-Bq4OR2jM.css","./assets/app-studio-yFqWHgNd.css","./assets/game-CsJqrJ4V.css","./assets/firebase-Ky9UFjrk.js","./assets/index-C8I4GLny.js","./assets/cinema-app-TqlMqtJO.js","./assets/call_calling-lCbVaN_l.js","./assets/call_ringing-DsEAApMW.js","./assets/camera_off-3Z-iK1YV.js","./assets/camera_on-CLtybwQe.js","./assets/deafen-B6kj_9kv.js","./assets/disconnect-CAYtlup-.js","./assets/message1-lsOerhd5.js","./assets/mute-BcRFXE7G.js","./assets/stream_ended-BD7JY2e7.js","./assets/stream_started-Bs70LHCf.js","./assets/undeafen-D3ROIJNg.js","./assets/unmute-lDKSm5uX.js","./assets/user_join-D_OxTIH8.js","./assets/user_leave-CNZyyO_h.js","./assets/youtube-app-C3mLFC00.js","./assets/nova-app-r9WXtfgF.js","./assets/desmos-app-UHu-TGhx.js","./assets/app-studio-BRIWiYhR.js","./assets/game-ZfwefGEZ.js","./assets/flick-game-Cog55LDo.js","./assets/hls-DjQ5pqwu.js","./assets/hls.worker-BU9d3XDG.js","./assets/bot-worker-CDGfK6Cp.js","./assets/call-replay.worker-BXCeDE0G.js","./assets/__vite-browser-external-9wXp6ZBx.js","./assets/movie-conversion.worker-RV-zIgYH.js"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT)||url.pathname.includes('/api/')||url.pathname.includes('/media/')||url.searchParams.has('ticket')||request.headers.has('Authorization'))return;
 // The aquarium archive is an independent site. Never cache or replace its
 // standalone video pages with the Vela PWA shell.
 if(url.pathname.startsWith(new URL('aq/',ROOT).pathname))return;
 // Nested shop pages must never replace the Vela app shell in its cache.
 if(url.pathname.startsWith(new URL('shop/',ROOT).pathname)){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok)event.waitUntil(cache.put(request,response.clone()));return response;}catch{return await cache.match(request,{ignoreVary:true})||new Response('Reconnect to open the shop.',{status:503,headers:{'Content-Type':'text/plain'}});}})());return;
 }
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
