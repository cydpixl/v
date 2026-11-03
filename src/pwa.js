export function registerPWA({busy,toast}){
 if(!('serviceWorker'in navigator))return;
 if(import.meta.env.DEV){navigator.serviceWorker.getRegistrations().then(list=>Promise.all(list.map(registration=>registration.unregister()))).catch(()=>{});return;}
 let lastCheck=0,initial=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{document.querySelector('.pwa-update')?.remove();initial=true;});
 const start=async()=>{
  try{
   const registration=await navigator.serviceWorker.register(new URL('sw.js',document.baseURI),{updateViaCache:'none'});
   const check=()=>{if(document.visibilityState==='visible'&&navigator.onLine&&Date.now()-lastCheck>900000){lastCheck=Date.now();registration.update().catch(()=>{});}};
   document.addEventListener('visibilitychange',check);window.addEventListener('online',check);check();
  }catch{/* Sign-in and messaging remain usable if installation is unavailable. */}
 };
 if(document.readyState==='complete')void start();else window.addEventListener('load',start,{once:true});
}
