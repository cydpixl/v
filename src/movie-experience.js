import {icon} from './icons.js';

const decorated=new WeakSet();
function decorate(root=document){
 const header=root.querySelector?.('.vela-cinema-header');
 if(header&&!header.querySelector('.spex-mini-brand')){header.querySelector('strong')?.insertAdjacentHTML('afterbegin','<span class="spex-mini-brand" aria-hidden="true">S▶</span>');const link=document.createElement('a');link.className='spex-open-link';link.href='https://bogart.pages.dev';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open Spex';header.append(link);}
 root.querySelectorAll?.('[data-watch-item]').forEach(card=>{
  if(decorated.has(card))return;decorated.add(card);
  const button=document.createElement('button');button.type='button';button.className='cinema-share-film';button.dataset.shareFilm='';button.setAttribute('aria-label','Send this film to a friend');button.innerHTML=icon('shareItem',17);card.append(button);
 });
 const player=root.querySelector?.('#vela-movie-player');
 if(player&&!player.dataset.touchReady){player.dataset.touchReady='true';const video=player.querySelector('video');let last=0;video.addEventListener('pointerup',event=>{if(event.pointerType==='mouse')return;const now=Date.now();if(now-last<340){const forward=event.clientX>video.getBoundingClientRect().left+video.clientWidth/2,amount=forward?10:-10;video.currentTime=Math.max(0,Math.min(video.duration||Infinity,video.currentTime+amount));const badge=document.createElement('span');badge.className='vela-touch-feedback '+(forward?'right':'left');badge.textContent=(forward?'+':'−')+'10 sec';player.append(badge);setTimeout(()=>badge.remove(),600);last=0}else last=now;});}
}
new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)decorate(node)}))).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',event=>{const button=event.target.closest('[data-share-film]');if(!button)return;event.preventDefault();event.stopPropagation();const card=button.closest('[data-watch-item]');if(!card)return;try{document.dispatchEvent(new CustomEvent('vela-share-film',{detail:JSON.parse(card.dataset.watchItem)}))}catch{}});
document.addEventListener('click',event=>{const card=event.target.closest('[data-shared-film]');if(!card)return;event.preventDefault();try{document.dispatchEvent(new CustomEvent('vela-open-film',{detail:JSON.parse(decodeURIComponent(card.dataset.sharedFilm))}))}catch{}});
decorate();
