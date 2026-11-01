(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>n.toLocaleString('en-US');
  let storage;
  try{storage=window.localStorage;storage.setItem('ashlan-storage-test','1');storage.removeItem('ashlan-storage-test');}catch{const memory=new Map();storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};}
  const wallet=AshlanWallet.createWallet(storage);
  const shell=$('sandbox-shell');
  let currentPage=null,returnItem=null;
  const packs=[{amount:800,price:'8.99',extra:'',color:'green'},{amount:2400,price:'22.99',extra:'17%',color:'blue'},{amount:4500,price:'36.99',extra:'36%',color:'purple'},{amount:12500,price:'89.99',extra:'56%',color:'orange'}];
  function notify(message){$('toast').textContent=message;$('toast').classList.add('is-visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.remove('is-visible'),3500);}
  function update(){
    const value=wallet.read();$('balance-count').textContent=fmt(value.balance);$('locker-count').textContent=value.purchases.length||'';
    document.querySelectorAll('[data-open]').forEach(card=>{const index=Number(card.dataset.open);const item=index>=0?window.ashlanShop.items()[index]:null;if(!item)return;const owned=wallet.owns(item,value);card.classList.toggle('is-owned',owned);let badge=card.querySelector('.owned-badge');if(owned&&!badge){badge=document.createElement('span');badge.className='owned-badge';badge.textContent='✓ OWNED';card.append(badge);}else if(!owned)badge?.remove();});
    const item=window.ashlanShop.current();if(item)updatePurchase(item);
  }
  function updatePurchase(item){
    const value=wallet.read(),owned=wallet.owns(item,value),button=$('purchase-item');
    const purchasable=Number.isSafeInteger(item.price)&&item.price>=0;
    button.disabled=owned||!purchasable;
    button.textContent=owned?'✓ OWNED':!purchasable?'NO SHOP OFFER':value.balance<item.price?'GET V-BUCKS':`PURCHASE · Ⓥ ${fmt(item.price)}`;
    $('purchase-status').textContent=owned?'In your locker.':!purchasable?'This catalog item has no current listed price.':`Balance: ${fmt(value.balance)} V-Bucks`;
  }
  function hide(){currentPage=null;shell.hidden=true;}
  function show(name){
    window.ashlanShop.close();currentPage=name;document.body.dataset.page=name;
    $('hero').hidden=true;$('shop-content').hidden=true;$('explore-shell').hidden=true;$('section-rail').hidden=true;shell.hidden=false;
    $('track-audio').pause();document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('is-active',b.dataset.sandbox===name));
    window.scrollTo({top:0,behavior:'instant'});if(name==='vbucks')renderPacks();else renderLocker();
  }
  function renderPacks(){
    shell.innerHTML=`<button class="text-back" id="back-to-shop">‹ ITEM SHOP</button><h1>PURCHASE V-BUCKS</h1><p class="sandbox-explainer">Choose your V-Bucks pack.</p><div class="pack-grid">${packs.map((p,i)=>`<button class="vbucks-pack ${p.color}" data-pack="${p.amount}" aria-label="Add ${fmt(p.amount)} V-Bucks for free">${p.extra?`<span class="pack-extra">${p.extra}<small>EXTRA*</small></span>`:''}<h2>${fmt(p.amount)} V-BUCKS</h2><img src="./assets/vbucks-${i}.webp" alt="Stack of V-Bucks" width="1024" height="1024"><div class="pack-bottom"><span class="pack-price">US store price <s>$${p.price}</s></span><strong>FREE</strong><span>ADD V-BUCKS</span></div></button>`).join('')}</div><div id="topup-result" class="topup-result" role="status" aria-live="polite"></div>`;
    $('back-to-shop').onclick=backToShop;
    shell.querySelectorAll('[data-pack]').forEach(button=>button.onclick=()=>{
      try{const amount=Number(button.dataset.pack);const result=wallet.topUp(amount);update();$('topup-result').innerHTML=`<strong>✓ ${fmt(amount)} V-Bucks added</strong><span>Balance: Ⓥ ${fmt(result.balance)}</span>${returnItem?'<button class="purchase-button" id="return-to-item">RETURN TO ITEM</button>':''}`;$('return-to-item')?.addEventListener('click',()=>{backToShop();window.ashlanShop.openSnapshot(returnItem);});notify(`${fmt(amount)} V-Bucks added`);}catch(error){notify(error.message);}
    });
  }
  function backToShop(){hide();document.querySelector('[data-view="shop"]').click();}
  function renderLocker(){
    const value=wallet.read();
    shell.innerHTML=`<h1>MY LOCKER</h1><label class="explore-search locker-search">Search locker<input type="search" id="locker-search" placeholder="Find your items"></label><div id="locker-grid" class="card-grid library-grid"></div><p id="locker-empty" class="explore-note"></p>`;
    function render(query=''){
      const items=value.purchases.filter(p=>p.item.name.toLowerCase().includes(query));
      $('locker-grid').innerHTML=items.map(p=>`<button class="library-item" data-owned="${esc(p.id)}" aria-label="Inspect ${esc(p.item.name)}"><div class="library-art"><img src="${esc(window.ashlanShop.items().find(x=>x.id===p.item.id)?.image||p.item.image)}" alt="" loading="lazy"><span class="library-new">OWNED</span></div><strong>${esc(p.item.name)}</strong><span class="library-meta">Ⓥ ${fmt(p.price)} · Purchased</span></button>`).join('');
      $('locker-empty').textContent=value.purchases.length?(items.length?'':'No matching locker items.'):'Your locker is empty. Find your next item in the shop.';
    }
    $('locker-search').oninput=e=>render(e.target.value.toLowerCase().trim());$('locker-grid').onclick=e=>{const card=e.target.closest('[data-owned]');if(!card)return;const purchase=value.purchases.find(p=>p.id===card.dataset.owned);if(purchase)window.ashlanShop.openSnapshot(purchase.item);};render();
  }
  $('purchase-item').onclick=()=>{
    const item=window.ashlanShop.current();if(!item)return;
    if(wallet.read().balance<item.price){returnItem=JSON.parse(JSON.stringify(item));show('vbucks');return;}
    try{wallet.purchase(item);window.ashlanShop.refresh();update();notify(`${item.name} added to your locker`);}catch(error){notify(error.message);}
  };
  $('wallet-balance').onclick=()=>{returnItem=null;show('vbucks');};$('get-vbucks').onclick=()=>{returnItem=null;show('vbucks');};
  $('filter-toggle').onclick=()=>{const open=document.body.classList.toggle('filters-open');$('filter-toggle').setAttribute('aria-expanded',String(open));$('filter-toggle').setAttribute('aria-label',open?'Hide shop filters':'Show shop filters');};
  document.querySelectorAll('[data-sandbox]').forEach(b=>b.onclick=()=>{returnItem=null;show(b.dataset.sandbox);});
  document.querySelectorAll('[data-view],[data-page]').forEach(b=>b.addEventListener('click',hide));$('brand-link').addEventListener('click',hide);$('header-heart').addEventListener('click',hide);
  window.addEventListener('ashlan-item-opened',e=>updatePurchase(e.detail));window.addEventListener('ashlan-shop-rendered',update);
  window.addEventListener('storage',e=>{if(e.key===wallet.key){update();if(currentPage==='locker')renderLocker();}});
  document.querySelectorAll('.more-menu .nav-link').forEach(button=>button.addEventListener('click',()=>{button.closest('details').open=false;}));
  document.addEventListener('click',event=>{if(!event.target.closest('.more-menu'))document.querySelector('.more-menu').open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('.more-menu').open=false;});
  window.ashlanShop.owns=item=>wallet.owns(item);
  update();
})();
