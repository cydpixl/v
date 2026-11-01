(() => {
 'use strict';
 if(parent===window||new URLSearchParams(location.search).get('embed')!=='vela')return;
 document.body.classList.add('vela-embedded');
 const button=document.getElementById('vela-send-item');let request=null,timer;
 const reset=()=>{clearTimeout(timer);request=null;button.disabled=false;button.textContent='Send to chat';};
 window.addEventListener('ashlan-item-opened',()=>{reset();button.hidden=false;});
 button.onclick=()=>{
  const item=window.ashlanShop.current();if(!item||request)return;
  document.getElementById('track-audio').pause();document.getElementById('stage-video').pause();
  request=crypto.randomUUID();button.disabled=true;button.textContent='Choose a chat…';
  parent.postMessage({type:'vela:shop:share',requestId:request,item:{kind:item.catalog?'cosmetic':'offer',id:item.id,name:item.name,type:item.typeLabel,price:item.price??null,image:item.image||'',...(item.cosmeticId?{cosmeticId:item.cosmeticId}:{})}},location.origin);
  timer=setTimeout(()=>{reset();button.textContent='Send to chat';},120000);
 };
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='vela:shop:result'||event.data.requestId!==request)return;
  const status=event.data.status;reset();button.textContent=status==='sent'?'Sent to chat ✓':status==='queued'?'Queued ✓':'Send to chat';
 });
 // A chat card remains inspectable after the daily offer rotates out.
 window.addEventListener('ashlan-shop-ready',()=>{
  try{
   const raw=JSON.parse(new URLSearchParams(location.search).get('shared')||'null');
   if(!raw||raw.kind!=='offer'||typeof raw.id!=='string'||raw.id.length>240||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>160)return;
   const current=window.ashlanShop.items().find(x=>x.id===raw.id||(raw.cosmeticId&&x.cosmeticId===raw.cosmeticId));
   if(current){if(!window.ashlanShop.current())window.ashlanShop.openOffer(current.id);return;}
   const image=new URL(raw.image);if(image.protocol!=='https:'||!['fortnite-api.com','cdn.fortnite-api.com','fortnite.com','cdn2.unrealengine.com','cms-assets.unrealengine.com'].includes(image.hostname))return;
   window.ashlanShop.openSnapshot({id:raw.id,name:raw.name,typeLabel:String(raw.type||'Cosmetic').slice(0,80),image:image.href,fallbackImage:image.href,price:null,regular:null,catalog:true,availability:'Not in today’s shop',description:'Shared in Vela.',section:'Shared item',colors:['#513160','#20112d'],category:/emote/i.test(raw.type)?'emote':'other',cosmeticId:typeof raw.cosmeticId==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(raw.cosmeticId)?raw.cosmeticId:null,contentItems:[],ownershipKeys:[],search:raw.name.toLowerCase(),history:[],variants:[]});
  }catch{}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){document.getElementById('track-audio').pause();document.getElementById('stage-video').pause();}});
})();
