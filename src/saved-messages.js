import {escape as e,date} from './util.js';
import {icon} from './icons.js';
import {messagePreview} from './message-preview.js';

export async function renderSavedMessages(host,{api,user,conversationTitle,openMessage,toast}){
 host.innerHTML='<section class="saved-messages"><h1>Saved Messages</h1><p>Messages bookmarked from your conversations.</p><input type="search" aria-label="Search saved messages" placeholder="Search messages, people, conversations or filenames"><p class="saved-message-count" role="status">Loading saved messages…</p><div class="saved-message-results" aria-busy="true"></div></section>';
 const root=host.firstElementChild,results=root.querySelector('.saved-message-results');
 const status=root.querySelector('.saved-message-count');
 let messages=[],loaded=false;
 function paint(){
  if(!loaded)return;
  const query=root.querySelector('input').value.trim().toLowerCase(),words=query.split(/\s+/).filter(Boolean);
  const filtered=messages.filter(m=>{const files=m.attachment?.kind==='files'?m.attachment.files:[m.attachment];const text=[m.deleted?'Message deleted':m.text,m.deleted?'':messagePreview(m.text,m.attachment),user(m.sender).name,conversationTitle(m.conversation),...files.map(f=>m.deleted?'':f?.name)].join(' ').toLowerCase();return words.every(word=>text.includes(word));});
  status.textContent=query?`${filtered.length} of ${messages.length} saved messages`:`${messages.length} saved message${messages.length===1?'':'s'}`;
  results.innerHTML=filtered.length?filtered.map(m=>`<article class="saved-message-row"><button class="saved-message-open" data-saved-open="${e(m.id)}"><strong>${e(user(m.sender).name)} <span>· ${e(conversationTitle(m.conversation))}</span></strong><p>${e(m.deleted?'Message deleted':messagePreview(m.text,m.attachment)||'Attachment')}</p><small>${date(m.created)} · View message</small></button><button class="icon-button" data-saved-remove="${e(m.id)}" aria-label="Remove saved message">${icon('bookmark')}</button></article>`).join(''):`<div class="empty-state"><h2>${query?'No matching messages':'No saved messages'}</h2><p>${query?'Try another search.':'Open a message menu and choose Save Message.'}</p></div>`;
 }
 root.querySelector('input').oninput=paint;
 root.onclick=async event=>{
  const open=event.target.closest('[data-saved-open]'),remove=event.target.closest('[data-saved-remove]');
  if(open&&!open.disabled){const message=messages.find(m=>m.id===open.dataset.savedOpen);if(message){open.disabled=true;try{await openMessage(message.id);}catch(error){if(root.isConnected)toast(error.message);}finally{if(root.isConnected)open.disabled=false;}}}
  if(remove){remove.disabled=true;try{await api('/messages/'+encodeURIComponent(remove.dataset.savedRemove),{method:'PATCH',body:{bookmark:false}});messages=messages.filter(m=>m.id!==remove.dataset.savedRemove);paint();}catch(error){remove.disabled=false;toast(error.message);}}
 };
 async function load(){results.setAttribute('aria-busy','true');status.textContent='Loading saved messages…';results.replaceChildren();try{messages=(await api('/bookmarks')).messages;loaded=true;if(root.isConnected)paint();}catch(error){if(root.isConnected){status.textContent='Saved messages could not load.';results.textContent=error.message;const retry=document.createElement('button');retry.className='secondary';retry.textContent='Retry';retry.onclick=load;results.append(retry);}}finally{if(root.isConnected)results.setAttribute('aria-busy','false');}}
 await load();
}
