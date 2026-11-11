import {isAppInstalled} from './desktop-storage.mjs';
import {icon} from './icons.js';
import {escape as e,mediaError} from './util.js';
import {assetURL} from './config.js';

export const appFeatures=[['music','music','Music','Browse songs and share listening activity.'],['fortnite','shop','Fortnite','The lobby, daily item shop and news.'],['drawing','edit','Drawing','Send a drawing from the message dock.'],['voice','mic','Voice messages','Record and send a voice note.']];
function features(uid){try{return JSON.parse(localStorage.getItem('vela.features.'+uid)||'{}')}catch{return {}}}
export function featureEnabled(uid,id){return features(uid)[id]!==false&&(['drawing','voice'].includes(id)||isAppInstalled(uid,id));}
export function mountFeatureSettings(target,uid){
 target.innerHTML='<h2>Chat tools</h2><p class="muted">Choose your Chat tools. Install Music and Fortnite from the App Store.</p><div class="feature-settings">'+appFeatures.map(([id,ico,name,desc])=>`<label class="feature-option">${icon(ico,23)}<span><strong>${name}</strong><small>${desc}</small></span><input type="checkbox" role="switch" data-feature="${id}" aria-label="Enable ${name}" ${featureEnabled(uid,id)?'checked':''}></label>`).join('')+'</div><p class="settings-feedback" role="status"></p>';
 target.querySelectorAll('[data-feature]').forEach(input=>input.onchange=()=>{localStorage.setItem('vela.features.'+uid,JSON.stringify({...features(uid),[input.dataset.feature]:input.checked}));target.querySelector('[role=status]').textContent='Your app updated.';window.dispatchEvent(new Event('vela-features-changed'));});
}
let openDock;
function dock(anchor,label,items){
 if(openDock){const same=openDock.anchor===anchor;openDock.close();if(same)return;}
 const panel=document.createElement('section'),events=new AbortController();panel.className='desktop-dock';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',label);panel.innerHTML=`<header>${e(label)}</header><div class="desktop-dock-grid">${items.map(([name,ico,run],i)=>`<button type="button" data-dock-item="${i}">${icon(ico,23)}<span>${e(name)}</span></button>`).join('')}</div>`;
 // A top-layer popover stays above windows regardless of their focus z-index.
 panel.setAttribute('popover','manual');document.body.append(panel);panel.showPopover();anchor.setAttribute('aria-expanded','true');
 function close(focus=false){events.abort();panel.remove();anchor.setAttribute('aria-expanded','false');if(openDock?.panel===panel)openDock=null;if(focus&&anchor.isConnected)anchor.focus();}
 openDock={anchor,panel,close};const r=anchor.getBoundingClientRect(),w=panel.offsetWidth,h=panel.offsetHeight;panel.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';panel.style.top=Math.max(8,Math.min(r.top>h+16?r.top-h-10:r.bottom+10,innerHeight-h-8))+'px';
 panel.querySelectorAll('[data-dock-item]').forEach(b=>b.onclick=()=>{close();Promise.resolve().then(items[Number(b.dataset.dockItem)][2]).catch(error=>window.dispatchEvent(new CustomEvent('vela-ui-error',{detail:error.message})));});
 document.addEventListener('pointerdown',ev=>{if(!panel.contains(ev.target)&&!anchor.contains(ev.target))close()},{capture:true,signal:events.signal});
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();close(true)}else if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Tab'].includes(ev.key)){ev.preventDefault();const buttons=[...panel.querySelectorAll('button')],i=buttons.indexOf(document.activeElement),step=ev.key==='ArrowDown'?3:ev.key==='ArrowUp'?-3:ev.key==='ArrowLeft'||ev.shiftKey?-1:1;buttons[(i+step+buttons.length)%buttons.length]?.focus();}},{signal:events.signal});window.addEventListener('resize',()=>close(),{once:true,signal:events.signal});panel.querySelector('button')?.focus();return panel;
}
export function openAppDock(anchor,{uid,open,settings}){return dock(anchor,'Your apps',[...appFeatures.filter(([id])=>['music','fortnite'].includes(id)&&featureEnabled(uid,id)).map(([id,ico,name])=>[name,ico,()=>open(id)]),['Customize','settings',settings]]);}
export function openShareDock(anchor,a){return dock(anchor,'Add to message',[
 ['File','attach',a.file],['Video','film',a.video],['Camera','camera',a.photo],['Screenshot','image',a.screenshot],
 ...(a.enabled('music')?[['Music','music',a.music]]:[]),['GIF','film',a.gif],['Sticker','sticker',a.sticker],
 ...(a.enabled('voice')?[['Voice note','mic',a.voice]]:[]),...(a.enabled('drawing')?[['Drawing','edit',a.draw]]:[]),['Schedule','schedule',a.schedule]
 ]);}
export async function captureScreenshot({modal,upload,toast}){
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Screenshots need a desktop browser that supports screen capture.');
 let stream,video;try{stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:false});video=document.createElement('video');video.srcObject=stream;video.muted=true;await video.play();if(!video.videoWidth)await new Promise((resolve,reject)=>{video.onloadeddata=resolve;setTimeout(()=>reject(Error('The screen could not be captured.')),5000)});await new Promise(resolve=>requestAnimationFrame(resolve));const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('The screenshot could not be created.');const file=new File([blob],'Screenshot-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png',{type:'image/png'}),url=URL.createObjectURL(blob);const dialog=modal('Screenshot',`<img class="screenshot-preview" src="${url}" alt="Screenshot preview"><footer><a class="secondary" href="${url}" download="${e(file.name)}">Save image</a><button class="primary" data-attach-screenshot>Attach to chat</button></footer>`,{wide:true,onclose:()=>URL.revokeObjectURL(url)});dialog.querySelector('[data-attach-screenshot]').onclick=async event=>{event.target.disabled=true;try{await upload(file);dialog.close();}catch(error){toast(error.message);event.target.disabled=false;}};
 }catch(error){if(error.name!=='NotAllowedError'&&error.name!=='AbortError')throw Error(mediaError(error));}finally{stream?.getTracks().forEach(t=>t.stop());if(video)video.srcObject=null;}
}
export function choosePresetAvatar({modal,onChoose}){
 const themes=[['adventurers','Adventurers'],['robots','Robots'],['pixel','Pixel art'],['portraits','Portraits'],['shapes','Abstract'],['fortnite','Fortnite']];let active=themes[0][0];
 const panel=modal('Profile pictures','<nav class="preset-tabs" aria-label="Profile picture themes">'+themes.map(([id,name])=>`<button type="button" data-preset-tab="${id}">${name}</button>`).join('')+'</nav><div class="preset-grid"></div>');
 function paint(){panel.querySelectorAll('[data-preset-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.presetTab===active)));panel.querySelector('.preset-grid').innerHTML=Array.from({length:12},(_,i)=>`<button type="button" data-preset="${i}" aria-label="${themes.find(t=>t[0]===active)[1]} picture ${i+1}"><img src="${assetURL('avatars/'+active+'-'+i+'.svg')}" alt="" loading="lazy"></button>`).join('');panel.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const source=assetURL('avatars/'+active+'-'+b.dataset.preset+'.svg');panel.close();onChoose(source);});}
 panel.querySelectorAll('[data-preset-tab]').forEach(b=>b.onclick=()=>{active=b.dataset.presetTab;paint()});paint();
}
