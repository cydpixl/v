import {COMMANDS,commandMatches} from './commands.mjs';
import './slash-commands.css';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bindSlashCommands(editor){
 const abort=new AbortController(),options={signal:abort.signal},popup=document.createElement('section');
 popup.id='vela-slash-picker';popup.className='slash-picker';popup.hidden=true;popup.setAttribute('aria-label','Slash commands');editor.closest('form').append(popup);
 let selected=0,botOnly=false,rows=[],dismissed=false;
 const close=()=>{popup.hidden=true;editor.setAttribute('aria-expanded','false');editor.removeAttribute('aria-activedescendant');};
 const choose=name=>{editor.value='/'+name+' ';editor.setSelectionRange(editor.value.length,editor.value.length);editor.dispatchEvent(new Event('input',{bubbles:true}));close();};
 function paint(){
  const value=editor.value;
  if(dismissed||!/^\/[a-z]*$/i.test(value)||document.activeElement!==editor){close();return;}
  rows=commandMatches(value,botOnly);selected=Math.min(selected,Math.max(0,rows.length-1));popup.hidden=false;
  editor.setAttribute('aria-controls',popup.id);editor.setAttribute('aria-expanded','true');editor.setAttribute('aria-autocomplete','list');
  popup.innerHTML=`<header><strong>Commands</strong><span>↑ ↓ to browse · Tab to select</span></header><nav aria-label="Command category"><button type="button" data-command-category="all" aria-pressed="${!botOnly}">All commands</button><button type="button" data-command-category="bot" aria-pressed="${botOnly}">VELA Bot</button></nav><div role="listbox" aria-label="Available commands">${rows.map((c,i)=>`<button type="button" role="option" id="vela-command-${c.name}" aria-selected="${selected===i}" data-command="${c.name}"><span class="slash-command-icon">${c.bot?'V':'/'}</span><span><strong>/${c.name}${c.args?` <small>${esc(c.args)}</small>`:''}</strong><em>${esc(c.description)}</em></span><b>${c.bot?'VELA':'Built-in'}</b></button>`).join('')||'<p>No matching commands</p>'}</div>`;
  if(rows[selected])editor.setAttribute('aria-activedescendant','vela-command-'+rows[selected].name);
 }
 editor.addEventListener('input',()=>{dismissed=false;selected=0;paint();},options);
 editor.addEventListener('focus',paint,options);
 editor.addEventListener('keydown',event=>{
  if(popup.hidden||event.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dismissed=true;close();return;}
  if(['ArrowDown','ArrowUp'].includes(event.key)&&rows.length){event.preventDefault();event.stopImmediatePropagation();selected=(selected+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;paint();popup.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});return;}
  if((event.key==='Tab'||event.key==='Enter'&&editor.value.slice(1)!==rows[selected]?.name)&&rows.length){event.preventDefault();event.stopImmediatePropagation();choose(rows[selected].name);return;}
  if(event.key==='Enter')close();
 },{...options,capture:true});
 popup.addEventListener('pointerdown',e=>e.preventDefault(),options);
 popup.addEventListener('click',event=>{const category=event.target.closest('[data-command-category]');if(category){botOnly=category.dataset.commandCategory==='bot';selected=0;paint();return;}const button=event.target.closest('[data-command]');if(button)choose(button.dataset.command);},options);
 document.addEventListener('pointerdown',event=>{if(event.target!==editor&&!popup.contains(event.target))close();},options);
 return ()=>{abort.abort();editor.removeAttribute('aria-controls');editor.removeAttribute('aria-expanded');editor.removeAttribute('aria-autocomplete');editor.removeAttribute('aria-activedescendant');popup.remove();};
}

const thumbnail=url=>/^https:\/\/cydpixl\.github\.io\/v\/media\/bodycam\/[A-Za-z0-9_-]+\.jpg$/.test(url||'')?url:'';
export function renderBotAttachment(attachment){
 if(attachment.kind==='command-help')return `<section class="vela-bot-help"><h3>VELA commands</h3><dl>${COMMANDS.map(c=>`<div><dt>/${c.name}</dt><dd>${esc(c.description)}</dd></div>`).join('')}</dl></section>`;
 if(attachment.kind!=='bodycam-library')return '';
 const items=Array.isArray(attachment.items)?attachment.items:[];
 return `<section class="vela-bot-library" data-bot-library><header><div><h3>Bodycam</h3><p>${items.length} videos · Everyone in this chat can watch</p></div><span class="bot-collection-icon">▶</span></header><label class="bot-library-search"><span class="sr-only">Search bodycam videos</span><input type="search" data-bot-filter placeholder="Search videos" aria-label="Search bodycam videos"></label><div class="bot-video-grid">${items.map(item=>`<button type="button" class="bot-video" data-bot-play="${esc(item.id)}" data-bot-search="${esc([item.title,item.channel].join(' ').toLowerCase())}" aria-label="Watch ${esc(item.title)}"><span class="bot-video-art">${thumbnail(item.poster)?`<img src="${esc(item.poster)}" alt="" loading="lazy">`:''}<span class="bot-play-icon">▶</span><small>${Math.floor(Number(item.duration||0)/60)}:${String(Math.floor(Number(item.duration||0)%60)).padStart(2,'0')}</small></span><strong>${esc(item.title)}</strong><span>${esc(item.channel)} · ${Number(item.height)||0}p</span></button>`).join('')}</div><p class="bot-no-results" hidden>No matching videos</p>${!items.length?'<p>No videos match this search. Try /bodycam without a search.</p>':''}</section>`;
}
