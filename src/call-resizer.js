export function bindCallResizer(stage,onResize){
 const grip=stage.querySelector('.call-resizer');
 const limits=()=>({min:180,max:Math.max(180,stage.parentElement.clientHeight-170)});
 const set=height=>{const {min,max}=limits(),value=Math.round(Math.max(min,Math.min(max,height)));onResize();stage.dataset.resized='true';stage.style.setProperty('--call-height',value+'px');grip.setAttribute('aria-valuenow',value);grip.setAttribute('aria-valuemin',min);grip.setAttribute('aria-valuemax',max);return value};
 let drag;
 grip.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();drag={y:event.clientY,height:stage.getBoundingClientRect().height};grip.setPointerCapture(event.pointerId);stage.classList.add('resizing')};
 grip.onpointermove=event=>{if(drag)set(drag.height+event.clientY-drag.y)};
 const finish=()=>{if(!drag)return;drag=null;stage.classList.remove('resizing');localStorage.setItem('vela.callHeight',stage.style.getPropertyValue('--call-height'))};
 grip.onpointerup=finish;grip.onpointercancel=finish;
 grip.ondblclick=()=>{delete stage.dataset.resized;stage.style.removeProperty('--call-height');localStorage.removeItem('vela.callHeight')};
 grip.onkeydown=event=>{const h=stage.getBoundingClientRect().height;if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();set(event.key==='Home'?limits().min:event.key==='End'?limits().max:h+(event.key==='ArrowDown'?24:-24));localStorage.setItem('vela.callHeight',stage.style.getPropertyValue('--call-height'))}};
 const saved=parseInt(localStorage.getItem('vela.callHeight'),10);if(saved)set(saved);
 const observer=new ResizeObserver(()=>{if(stage.dataset.resized&&stage.offsetHeight)set(parseInt(stage.style.getPropertyValue('--call-height'),10))});observer.observe(stage.parentElement);
 return ()=>observer.disconnect();
}
