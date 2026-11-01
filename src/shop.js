import {assetURL} from './config.js';
import {escape as e} from './util.js';
import {createShopMessage,normalizeShopItem,parseShopMessage,shopItemHash} from './shop-message.mjs';
import './shop.css';

export function createShop({S,modal,title,toast,render,send}){
 let frame=null,initialItem=null,dialog=null;
 function unmount(){frame?.remove();frame=null;dialog?.close();dialog=null;}
 function show(item=null){if(item){initialItem=normalizeShopItem(item);frame?.remove();frame=null;}S.view='shop';render();}
 function mount(host){
  host.className='shop-content';if(frame?.isConnected)return;
  const url=new URL(assetURL('shop/index.html'),location.href);url.searchParams.set('embed','vela');if(initialItem){url.hash=shopItemHash(initialItem);if(initialItem.kind==='offer')url.searchParams.set('shared',JSON.stringify(initialItem));}initialItem=null;
  host.replaceChildren();frame=document.createElement('iframe');frame.className='vela-shop-frame';frame.title='Ashlan Shop';frame.allow='autoplay; fullscreen; picture-in-picture';frame.referrerPolicy='same-origin';frame.src=url.href;host.append(frame);
 }
 window.addEventListener('message',event=>{
  if(!S.user||S.view!=='shop'||event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='vela:shop:share')return;
  const request=event.data.requestId,item=normalizeShopItem(event.data.item);if(typeof request!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(request)||!item)return;
  if(dialog?.open)return;
  const owner=S.user.uid,source=event.source,reply=status=>source.postMessage({type:'vela:shop:result',requestId:request,status},location.origin);
  let selected=S.conversations.some(c=>c.id===S.active)?S.active:null,busy=false,finished=false;
  const sheet=modal('Send item to chat',`<div class="shop-share-summary">${item.image?`<img src="${e(item.image)}" alt="">`:''}<span><strong>${e(item.name)}</strong><small>${e(item.type)}${item.price===null?'':' · Ⓥ '+item.price.toLocaleString('en-US')}</small></span></div><label class="shop-recipient-label">Choose a conversation<input type="search" data-shop-search placeholder="Search chats" autocomplete="off"></label><div class="shop-recipient-list" role="group" aria-label="Choose a conversation"></div><p class="shop-send-status" role="status"></p><button class="primary wide" type="button" data-shop-send ${selected?'':'disabled'}>Send item</button>`,{onclose:()=>{if(!finished)reply('cancelled');if(dialog===sheet)dialog=null;}});dialog=sheet;
  const results=sheet.querySelector('.shop-recipient-list'),sendButton=sheet.querySelector('[data-shop-send]'),status=sheet.querySelector('[role=status]');
  function paint(query=''){
   const chats=S.conversations.filter(c=>title(c).toLowerCase().includes(query.toLowerCase()));
   results.innerHTML=chats.map(c=>`<button class="shop-recipient ${selected===c.id?'selected':''}" type="button" data-shop-recipient="${e(c.id)}" aria-pressed="${selected===c.id}"><span>${e(title(c))}</span><small>${c.kind==='group'?'Group chat':'Direct message'}</small>${selected===c.id?'<b>✓</b>':''}</button>`).join('')||`<p class="muted">${S.conversations.length?'No matching chats.':'Start a conversation in Vela, then return here to share an item.'}</p>`;
  }
  sheet.querySelector('[data-shop-search]').oninput=event=>paint(event.target.value);
  results.onclick=event=>{const button=event.target.closest('[data-shop-recipient]');if(!button||busy)return;selected=button.dataset.shopRecipient;sendButton.disabled=false;paint(sheet.querySelector('input').value);};
  sendButton.onclick=async()=>{
   if(busy||!selected)return;if(S.user?.uid!==owner){status.textContent='Your account changed. Reopen the shop.';return;}
   busy=true;sendButton.disabled=true;sendButton.textContent='Sending…';status.textContent='';
   try{const queued=await send(selected,createShopMessage(item),owner);finished=true;reply(queued?'queued':'sent');sheet.close();toast(queued?'Item queued. It will retry when you reconnect.':'Item sent to '+title(S.conversations.find(c=>c.id===selected))+'.');}
   catch(error){status.textContent=error.message;busy=false;sendButton.disabled=false;sendButton.textContent='Send item';}
  };
  paint();sheet.querySelector('input').focus();
 });
 document.addEventListener('click',event=>{const button=event.target.closest('[data-shop-message]');if(!button)return;const item=parseShopMessage(button.dataset.shopMessage);if(item){event.preventDefault();show(item);}});
 return {show,mount,unmount};
}
