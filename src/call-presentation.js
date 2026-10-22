// Fullscreen the shared workspace so cameras stay beside the selected media.
export async function fullscreenCall(stage){
 if(document.fullscreenElement)await document.exitFullscreen();
 else if(stage?.requestFullscreen)await stage.requestFullscreen();
 else throw Error('Fullscreen is unavailable in this browser.');
}

let floating,refresh;
export function closeCallPip(){clearInterval(refresh);refresh=null;floating?.close();floating=null;}
export async function pictureInPicture(stage,preferred){
 if(floating&&!floating.closed){closeCallPip();return;}
 if(!window.documentPictureInPicture){
  const video=preferred?.querySelector('video')||stage.querySelector('.focused video')||stage.querySelector('.screen-tile video')||stage.querySelector('.call-tile.video-enabled video');
  if(!document.pictureInPictureEnabled||!video||video.readyState<2)throw Error('Picture in picture needs a playing video and a supported browser.');
  if(document.pictureInPictureElement)await document.exitPictureInPicture();else await video.requestPictureInPicture();return;
 }
 const win=await window.documentPictureInPicture.requestWindow({width:780,height:480});floating=win;
 const doc=win.document;doc.title='Vela call';
 const style=doc.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;background:#0c0d11;color:white;font:14px system-ui;height:100vh;display:flex;flex-direction:column}header{padding:8px;display:flex;justify-content:space-between;align-items:center}button{background:#30343f;color:white;border:0;border-radius:5px;padding:7px;cursor:pointer}main{flex:1;min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:8px}figure{margin:0;min-height:0;position:relative;background:#17191f;border-radius:6px;overflow:hidden}figure.main{grid-column:1/-1;min-height:55%}video{width:100%;height:100%;object-fit:contain}figcaption{position:absolute;left:8px;bottom:8px;background:#0009;padding:3px 6px;border-radius:4px}';doc.head.append(style);
 const header=doc.createElement('header'),label=doc.createElement('span'),back=doc.createElement('button'),grid=doc.createElement('main');label.textContent='Vela · Call';back.textContent='Back to call';back.onclick=()=>{window.focus();closeCallPip();};header.append(label,back);doc.body.append(header,grid);
 const copies=new Map();
 const sync=()=>{
  if(!stage.isConnected||stage.hidden){closeCallPip();return;}
  const sources=[...(stage.matches('#vela-movie-player')?[stage]:[]),...stage.querySelectorAll('.call-tile.video-enabled, #vela-movie-player')].filter(tile=>tile.querySelector('video')?.readyState>=2);
  const main=sources.find(t=>t===preferred)||sources.find(t=>t.classList.contains('focused'))||sources.find(t=>t.classList.contains('screen-tile')||t.id==='vela-movie-player');
  for(const [tile,copy]of copies)if(!sources.includes(tile)){copy.querySelector('video').srcObject=null;copy.remove();copies.delete(tile);}
  for(const tile of sources){const original=tile.querySelector('video');let copy=copies.get(tile);if(!copy){copy=doc.createElement('figure');const video=doc.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;const caption=doc.createElement('figcaption');copy.append(video,caption);copies.set(tile,copy);grid.append(copy);}copy.classList.toggle('main',tile===main);copy.style.order=tile===main?'-1':'0';copy.querySelector('figcaption').textContent=tile.querySelector('.tile-label span,header strong')?.textContent||'Video';const video=copy.querySelector('video');if(original.srcObject){if(video.srcObject!==original.srcObject)video.srcObject=original.srcObject;}else{if(video.src!==original.currentSrc)video.src=original.currentSrc;if(Math.abs(video.currentTime-original.currentTime)>.5)video.currentTime=original.currentTime;if(original.paused)video.pause();}if(!original.paused)video.play().catch(()=>{});}
 };
 win.addEventListener('pagehide',()=>{clearInterval(refresh);refresh=null;for(const copy of copies.values()){const v=copy.querySelector('video');v.pause();v.srcObject=null;v.removeAttribute('src');v.load();}if(floating===win)floating=null;},{once:true});sync();refresh=setInterval(sync,300);
}
