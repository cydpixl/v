const PREFIX='[[vela-shop:1:';
const pattern=/^\[\[vela-shop:1:([A-Za-z0-9_-]{8,3500})\]\]$/;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeShopItem(raw){
 if(!raw||typeof raw!=='object'||!['offer','cosmetic'].includes(raw.kind)||typeof raw.id!=='string'||!raw.id||raw.id.length>240||/[\u0000-\u001f]/.test(raw.id))return null;
 if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>160)return null;
 if(raw.price!==null&&(!Number.isSafeInteger(raw.price)||raw.price<0||raw.price>1000000))return null;
 let image='';
 if(raw.image){try{const u=new URL(raw.image);if(u.protocol!=='https:'||u.username||u.password||raw.image.length>1200||!['fortnite-api.com','cdn.fortnite-api.com','fortnite.com','cdn2.unrealengine.com','cms-assets.unrealengine.com'].includes(u.hostname))return null;image=u.href;}catch{return null;}}
 if(raw.cosmeticId!==undefined&&(typeof raw.cosmeticId!=='string'||!raw.cosmeticId||raw.cosmeticId.length>160||!/^[a-zA-Z0-9_-]+$/.test(raw.cosmeticId)))return null;
 return {...(raw.cosmeticId?{cosmeticId:raw.cosmeticId}:{}),kind:raw.kind,id:raw.id,name:raw.name.trim(),type:typeof raw.type==='string'?raw.type.slice(0,80):'Cosmetic',price:raw.price,image};
}
export function createShopMessage(raw){
 const item=normalizeShopItem(raw);if(!item)throw Error('This shop item cannot be shared.');
 const encoded=btoa(Array.from(new TextEncoder().encode(JSON.stringify(item)),b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 if(encoded.length>3500)throw Error('This item has too much detail to share.');return PREFIX+encoded+']]';
}
export function parseShopMessage(text){
 if(typeof text!=='string'||text.length>3520)return null;const match=text.match(pattern);if(!match)return null;
 try{return normalizeShopItem(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(match[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))));}catch{return null;}
}
export function shopItemHash(item){return '#'+(item.kind==='cosmetic'?'cosmetic=':'item=')+encodeURIComponent(item.id);}
export function shopMessageMarkup(text){
 const item=parseShopMessage(text);if(!item)return '';
 return `<button class="shared-shop-card" type="button" data-shop-message="${escape(text)}" aria-label="View ${escape(item.name)} in Shop">${item.image?`<img src="${escape(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span><small>ASHLAN SHOP · FORTNITE</small><strong>${escape(item.name)}</strong><em>${escape(item.type)}${item.price===null?'':' · Ⓥ '+item.price.toLocaleString('en-US')}</em><b>View in Shop ↗</b></span></button>`;
}
