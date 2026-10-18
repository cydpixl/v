import {assetURL} from './config.js';
import {escape as e} from './util.js';
import {icon} from './icons.js';
let catalogPromise;
const categoryNames={people:'Smileys & People',nature:'Animals & Nature',foods:'Food & Drink',activity:'Activities',places:'Travel & Places',objects:'Objects',symbols:'Symbols',flags:'Flags'};
const categorySymbols={people:'1f600',nature:'1f43b',foods:'1f354',activity:'26bd',places:'1f697',objects:'1f4a1',symbols:'1f523',flags:'1f3c1'};
const image=(skin,size='')=>`<img class="emoji ${size}" src="${assetURL('emoji/')}${skin.asset||skin.unified} .svg" alt="${e(skin.native)}" loading="lazy" draggable="false">`.replace(' .svg','.svg');
export async function createEmojiPicker({anchor,uid,onSelect,onClose}){
 catalogPromise??=fetch(assetURL('emoji-data.json')).then(r=>{if(!r.ok)throw Error('Emoji could not be loaded. Try again.');return r.json()}).catch(err=>{catalogPromise=null;throw err});
 const data=await catalogPromise,storageKey='vela.emoji.'+uid;
 let stored;try{stored=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{stored={}}
 let recent=Array.isArray(stored.recent)?stored.recent.filter(id=>data.emojis[id]).slice(0,40):[],tone=Math.min(5,Number(stored.tone)||0),category=recent.length?'recent':'people',results=[];
 const picker=document.createElement('section');picker.className='popover-menu expression-picker';picker.setAttribute('role','dialog');picker.setAttribute('aria-label','Emoji');
 picker.innerHTML=`<header><span class="expression-tab">Emoji</span><button class="icon-button emoji-close" aria-label="Close emoji picker">${icon('close',18)}</button></header><div class="expression-search"><div>${icon('search',18)}<input aria-label="Find the perfect emoji" placeholder="Find the perfect emoji" autocomplete="off"></div><button class="tone-button" aria-label="Skin tone" title="Skin tone">${image({unified:'1f44b',native:'👋'})}</button><div class="tone-choices" hidden></div></div><div class="expression-body"><nav aria-label="Emoji categories"><button data-category="recent" aria-label="Frequently Used" title="Frequently Used">${icon('refresh',22)}</button>${data.categories.map(c=>`<button data-category="${c.id}" title="${categoryNames[c.id]}" aria-label="${categoryNames[c.id]}"><img src="/emoji/${categorySymbols[c.id]}.svg" alt="" width="22" height="22"></button>`).join('')}</nav><div class="expression-results"><h3></h3><div class="expression-grid" role="grid"></div><p class="expression-empty" hidden>No emoji found.</p></div></div><footer><span class="emoji-preview"></span><div><strong>Emoji</strong><small>Select an emoji</small></div></footer>`;
 const search=picker.querySelector('input'),grid=picker.querySelector('.expression-grid'),footer=picker.querySelector('footer'),rail=picker.querySelector('nav');
 const skinFor=item=>item.skins[tone]||item.skins[0];
 const preview=id=>{const item=data.emojis[id];if(!item)return;footer.querySelector('.emoji-preview').innerHTML=image(skinFor(item));footer.querySelector('strong').textContent=':'+item.id+':';footer.querySelector('small').textContent=item.name};
 const save=()=>localStorage.setItem(storageKey,JSON.stringify({recent,tone}));
 const choose=id=>{const item=data.emojis[id];if(!item)return;recent=[id,...recent.filter(x=>x!==id)].slice(0,40);save();onSelect(skinFor(item).native);onClose()};
 const draw=()=>{
  const query=search.value.trim().toLowerCase().replace(/^:|:$/g,'');
  results=query?Object.values(data.emojis).filter(item=>query.split(/\s+/).every(word=>(item.id+' '+item.name+' '+(item.keywords||[]).join(' ')).toLowerCase().includes(word))): (category==='recent'?recent:data.categories.find(c=>c.id===category)?.emojis||[]).map(id=>data.emojis[id]).filter(Boolean);
  if(query){const rank=item=>item.id===query?0:item.id.startsWith(query)?1:item.id.includes(query)?2:3;results.sort((a,b)=>rank(a)-rank(b));}
  picker.querySelector('h3').textContent=query?'Search Results':category==='recent'?'Frequently Used':categoryNames[category];
  grid.innerHTML=results.map((item,index)=>`<button type="button" role="gridcell" tabindex="${index===0?'0':'-1'}" aria-label=":${e(item.id)}:" data-emoji-id="${e(item.id)}" title=":${e(item.id)}:">${image(skinFor(item))}</button>`).join('');
  const empty=picker.querySelector('.expression-empty');empty.hidden=results.length>0;empty.textContent=query?'No emoji found.':'Your recently used emoji will appear here.';
  rail.querySelectorAll('button').forEach(btn=>btn.classList.toggle('selected',btn.dataset.category===category&&!query));picker.querySelector('.expression-results').scrollTop=0;if(results[0])preview(results[0].id);
 };
 rail.onclick=event=>{const button=event.target.closest('[data-category]');if(button){category=button.dataset.category;search.value='';draw()}};
 search.oninput=draw;search.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();grid.querySelector('button')?.focus()}if(event.key==='Enter'&&results[0]){event.preventDefault();choose(results[0].id)}};
 grid.onclick=event=>{const button=event.target.closest('[data-emoji-id]');if(button)choose(button.dataset.emojiId)};
 grid.onpointerover=event=>{const button=event.target.closest('[data-emoji-id]');if(button)preview(button.dataset.emojiId)};
 grid.onfocusin=event=>{if(event.target.dataset.emojiId)preview(event.target.dataset.emojiId)};
 grid.onkeydown=event=>{const buttons=[...grid.querySelectorAll('button')],index=buttons.indexOf(document.activeElement),columns=9;let next;if(event.key==='ArrowRight')next=index+1;if(event.key==='ArrowLeft')next=index-1;if(event.key==='ArrowDown')next=index+columns;if(event.key==='ArrowUp')next=index-columns;if(next!==undefined){event.preventDefault();buttons[Math.min(buttons.length-1,Math.max(0,next))]?.focus()}};
 picker.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose()}};
 picker.querySelector('.emoji-close').onclick=onClose;
 const choices=picker.querySelector('.tone-choices');choices.innerHTML=['1f44b',...['1f3fb','1f3fc','1f3fd','1f3fe','1f3ff'].map(t=>'1f44b-'+t)].map((unified,index)=>`<button aria-label="Skin tone ${index===0?'default':index}" data-tone="${index}">${image({unified,native:'👋'})}</button>`).join('');
 picker.querySelector('.tone-button').onclick=()=>{choices.hidden=!choices.hidden};choices.onclick=event=>{const btn=event.target.closest('[data-tone]');if(btn){tone=Number(btn.dataset.tone);save();choices.hidden=true;picker.querySelector('.tone-button').innerHTML=btn.innerHTML;draw()}};
 draw();requestAnimationFrame(()=>search.focus());
 return picker;
}

