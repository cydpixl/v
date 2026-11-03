// Pointer dragging works on empty desktop space, with mouse, pen, and touch.
export function arrangeDesktopIcons(dock,owner){
 const key='desktop.app.positions.'+owner;
 let saved;try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{saved={}}
 const bounds=()=>({width:Math.max(90,innerWidth-24),height:Math.max(108,innerHeight-65)});
 function place(button,x,y){const b=bounds();button.style.left=Math.max(0,Math.min(b.width-90,x))+'px';button.style.top=Math.max(0,Math.min(b.height-108,y))+'px'}
 dock.querySelectorAll('[data-hub-app]').forEach((button,index)=>{
  button.draggable=false;button.querySelectorAll('img').forEach(img=>img.draggable=false);
  const columns=Math.max(1,Math.floor(Math.min(innerWidth-36,570)/104));
  const point=saved[button.dataset.hubApp]||{x:20+(index%columns)*104,y:32+Math.floor(index/columns)*126};place(button,point.x,point.y);
  let suppress=false;
  button.addEventListener('click',event=>{if(suppress){event.preventDefault();event.stopImmediatePropagation();suppress=false}},{capture:true});
  button.onpointerdown=event=>{
   if(event.button!==0||button.classList.contains('is-installing'))return;
   const initial={x:event.clientX,y:event.clientY,left:parseFloat(button.style.left),top:parseFloat(button.style.top)};let moved=false;
   button.setPointerCapture(event.pointerId);
   const move=ev=>{if(Math.hypot(ev.clientX-initial.x,ev.clientY-initial.y)<5&&!moved)return;moved=true;button.classList.add('icon-moving');place(button,initial.left+ev.clientX-initial.x,initial.top+ev.clientY-initial.y)};
   const stop=()=>{button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',stop);button.removeEventListener('pointercancel',stop);button.removeEventListener('lostpointercapture',stop);button.classList.remove('icon-moving');if(moved){suppress=true;saved[button.dataset.hubApp]={x:parseFloat(button.style.left),y:parseFloat(button.style.top)};localStorage.setItem(key,JSON.stringify(saved));setTimeout(()=>suppress=false,0)}};
   button.addEventListener('pointermove',move);button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);
  };
 });
}
