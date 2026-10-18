import {assetURL} from './config.js';
import twemoji from '@twemoji/api';
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const time=stamp=>new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(stamp);
export const date=stamp=>new Intl.DateTimeFormat(undefined,{month:'long',day:'numeric',year:'numeric'}).format(stamp);
export const bytes=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';
export const initials=name=>String(name||'?').split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
export const online=user=>user.status!=='invisible'&&user.presence!=='invisible'&&Date.now()-user.last_seen<95000;
export function safeURL(url){if(typeof url!=='string'||!url.trim())return '';try{const u=new URL(url,location.origin);return ['https:','http:','data:'].includes(u.protocol)?u.href:''}catch{return ''}}
export function avatar(user,size=''){const name=user?.name||user?.handle||'User',src=safeURL(user?.avatar);return `<span class="avatar ${size}" style="--avatar-hue:${[...name].reduce((a,c)=>a+c.charCodeAt(0),0)%360}">${src?`<img src="${escape(src)}" alt="" loading="lazy">`:escape(initials(name))}<i class="presence ${online(user||{})?(user?.presence||user?.status||'online'):'offline'}"></i></span>`;}
export function mediaError(error){return ({NotAllowedError:'Permission was denied. Allow access in your browser’s site settings and try again.',NotFoundError:'No matching camera or microphone is connected.',NotReadableError:'Your device is busy in another application.',OverconstrainedError:'That quality or device is unavailable. Try Auto.'})[error.name]||error.message||'Media could not be started.';}
export function messageHTML(text){return escape(text).replace(/https?:\/\/[^\s<]+/g,url=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>');}

export function renderEmoji(element){twemoji.parse(element,{base:assetURL('emoji/'),folder:'',ext:'.svg',className:'emoji',attributes:()=>({loading:'lazy',draggable:'false'})});for(const message of element.querySelectorAll('.message-text')){const count=message.querySelectorAll('img.emoji').length;message.classList.toggle('jumbo-emoji',!message.textContent.trim()&&count>0&&count<=3);}}
