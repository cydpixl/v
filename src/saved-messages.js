import {escape as e,date} from './util.js';
import {icon} from './icons.js';
import {messagePreview} from './message-preview.js';

export async function renderSavedMessages(host,{api,user,conversationTitle,openChat,toast}){
 host.innerHTML='<section class="saved-messages"><h1>Saved Messages</h1><p>Messages bookmarked from your conversations.</p><input type="search" aria-label="Search saved messages" placeholder="Search saved messages"><div class="saved-message-results" role="status">Loading saved messages…</div></section>';
 const root=host.firstElementChild,results=root.querySelector('.saved-message-results');
 let messages=[];
 function paint(){
  const query=root.querySelector('input').value.trim().toLowerCase();
  const filtered=messages.filter(m=>[m.text,user(m.sender).name,conversationTitle(m.conversation)].join(' ').toLowerCase().includes(query));
  results.innerHTML=filtered.length?filtered.map(m=>`<article class="saved-message-row"><button class="saved-message-open" data-saved-open="${e(m.id)}"><strong>${e(user(m.sender).name)} <span>· ${e(conversationTitle(m.conversation))}</span></strong><p>${e(m.deleted?'Message deleted':messagePreview(m.text,m.attachment)||'Attachment')}</p><small>${date(m.created)} · Open conversation</small></button><button class="icon-button" data-saved-remove="${e(m.id)}" aria-label="Remove saved message">${icon('bookmark')}</button></article>`).join(''):`<div class="empty-state"><h2>${query?'No matching messages':'No saved messages'}</h2><p>${query?'Try another search.':'Open a message menu and choose Save Message.'}</p></div>`;
 }
 root.querySelector('input').oninput=paint;
 root.onclick=async event=>{
  const open=event.target.closest('[data-saved-open]'),remove=event.target.closest('[data-saved-remove]');
  if(open){const message=messages.find(m=>m.id===open.dataset.savedOpen);if(message)openChat(message.conversation);}
  if(remove){remove.disabled=true;try{await api('/messages/'+encodeURIComponent(remove.dataset.savedRemove),{method:'PATCH',body:{bookmark:false}});messages=messages.filter(m=>m.id!==remove.dataset.savedRemove);paint();}catch(error){remove.disabled=false;toast(error.message);}}
 };
 try{messages=(await api('/bookmarks')).messages;if(root.isConnected)paint();}catch(error){if(root.isConnected){results.textContent=error.message;const retry=document.createElement('button');retry.className='secondary';retry.textContent='Retry';retry.onclick=()=>renderSavedMessages(host,{api,user,conversationTitle,openChat,toast});results.append(retry);}}
}
