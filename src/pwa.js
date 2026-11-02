export function registerPWA({busy,toast}){
 if(!('serviceWorker'in navigator))return;
 let lastCheck=0,initial=!!navigator.serviceWorker.controller;
 const showUpdate=()=>{
  if(document.querySelector('.pwa-update'))return;
  const notice=document.createElement('div');notice.className='pwa-update';notice.setAttribute('role','status');
  notice.innerHTML='<span>A Vela update is ready.</span><button class="primary">Update</button><button class="text-button" aria-label="Dismiss update">Later</button>';
  notice.querySelector('.primary').onclick=()=>{if(busy()){toast('Finish your upload or call, then update Vela.');return;}location.reload();};
  notice.querySelector('.text-button').onclick=()=>notice.remove();document.body.append(notice);
 };
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(initial)showUpdate();initial=true;});
 const start=async()=>{
  try{
   const registration=await navigator.serviceWorker.register(new URL('sw.js',document.baseURI),{updateViaCache:'none'});
   const check=()=>{if(document.visibilityState==='visible'&&navigator.onLine&&Date.now()-lastCheck>900000){lastCheck=Date.now();registration.update().catch(()=>{});}};
   document.addEventListener('visibilitychange',check);window.addEventListener('online',check);check();
  }catch{/* Sign-in and messaging remain usable if installation is unavailable. */}
 };
 if(document.readyState==='complete')void start();else window.addEventListener('load',start,{once:true});
}
