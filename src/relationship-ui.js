import {escape as e} from './util.js';
export function conversationRestriction(c){
 if(!c)return '';
 if(c.kind==='group')return c.communicationBlocked?'Messaging and calls are unavailable because a blocked account is in this group.':'';
 if(c.blocked&&c.blockedBy)return 'You and this account have blocked each other. Messages and calls are unavailable.';
 if(c.blocked)return 'You blocked this account. Unblock them to send messages or start calls.';
 if(c.blockedBy)return 'This account has blocked you. You cannot send messages or start calls.';
 return '';
}
export function renderRestriction({conversation,form,banner,onUnblock}){
 const reason=conversationRestriction(conversation);
 banner.hidden=!reason;
 banner.innerHTML=reason?`<span>${e(reason)}</span>${conversation.blocked?'<button type="button" class="secondary" data-unblock-chat>Unblock</button>':''}`:'';
 banner.querySelector('[data-unblock-chat]')?.addEventListener('click',onUnblock);
 form.inert=!!reason;form.setAttribute('aria-disabled',String(!!reason));
 form.querySelectorAll('button,input').forEach(button=>button.disabled=!!reason);
 const composer=form.querySelector('[contenteditable]');if(composer){composer.contentEditable=String(!reason);composer.setAttribute('aria-disabled',String(!!reason));}
 return !!reason;
}
