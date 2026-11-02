import {assetURL} from './config.js';
import {escape as e} from './util.js';
import {desktopProfile,desktopUnlocked,saveDesktopProfile,unlockDesktop,profilePicture} from './desktop-profile.mjs';
import './desktop-boot.css';
let screen,pending,screenClock;
const mark='<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M92 106h91l73 201 73-201h91L307 411H205z" fill="currentColor"/><path d="M216 166h80l-40 113z" fill="currentColor"/></svg>';
function createScreen(label){const dialog=document.createElement('dialog');dialog.className='desktop-boot-screen';dialog.setAttribute('aria-label',label);dialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(dialog);dialog.showModal();return dialog;}
export function startDesktopBoot(){
 if(pending)return pending;
 if(window.__velaInitialBoot){screen=window.__velaInitialBoot.element;pending=window.__velaInitialBoot.ready;return pending;}
 screen=createScreen('Starting VELA Desktop');screen.dataset.phase='boot';
 screen.innerHTML=`<div class="pc-boot-brand">${mark}</div><div class="pc-boot-progress" role="progressbar" aria-label="Starting VELA Desktop" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>`;
 const began=performance.now();pending=new Promise(resolve=>{const timer=setInterval(()=>{const elapsed=performance.now()-began,percent=Math.min(100,elapsed/150);const bar=screen?.querySelector('[role=progressbar]');if(bar){bar.setAttribute('aria-valuenow',Math.floor(percent));bar.firstElementChild.style.width=percent+'%';}if(elapsed>=15000){clearInterval(timer);if(screen)screen.dataset.bootComplete='true';resolve();}},80)});return pending;
}
export function finishBoot(){clearInterval(screenClock);screen?.close();screen?.remove();screen=null;document.getElementById('vela-first-paint-boot-style')?.remove();}
export async function enterDesktop({user,onDone=()=>{},forceLock=false}){
 await startDesktopBoot();const uid=user.uid,profile=desktopProfile(uid);
 if(profile&&desktopUnlocked(uid)&&!forceLock){finishBoot();onDone();return;}
 if(!screen?.isConnected)screen=createScreen(profile?'Unlock VELA Desktop':'Set up VELA Desktop');
 screen.removeAttribute('id');document.getElementById('vela-first-paint-boot-style')?.remove();screen.dataset.phase=profile?'lock':'setup';
 return new Promise(resolve=>{
  const done=()=>{finishBoot();onDone();resolve()};
  if(profile){
   clearInterval(screenClock);screenClock=setInterval(()=>{const clock=screen?.querySelector('.pc-lock-clock');if(clock){clock.querySelector('time').textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});clock.querySelector('p').textContent=new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}},1000);
   let mode='passcode';screen.style.setProperty('--lock-wallpaper','var(--custom-wallpaper,var(--wallpaper))');
   const paint=()=>{screen.innerHTML=`<div class="pc-lock-clock"><time>${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time><p>${new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}</p></div><form class="pc-unlock"><img class="pc-profile-picture" src="${e(profilePicture(profile))}" alt=""><h1>${e(profile.name)}</h1><label class="sr-only" for="desktop-unlock">${mode==='passcode'?'Passcode':'Desktop password'}</label><div class="pc-unlock-input"><input id="desktop-unlock" name="secret" type="password" ${mode==='passcode'?'inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8"':'autocomplete="current-password"'} placeholder="${mode==='passcode'?'Enter your passcode':'Enter your password'}" required><button type="submit" aria-label="Unlock desktop">→</button></div><p class="pc-form-error" role="alert"></p><button class="pc-text" type="button" data-mode>Use ${mode==='passcode'?'password':'passcode'}</button></form><span class="pc-lock-brand">${mark}<span>VELA</span></span>`;
   const form=screen.querySelector('form');form.querySelector('[data-mode]').onclick=()=>{mode=mode==='passcode'?'password':'passcode';paint()};form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await unlockDesktop(uid,form.elements.secret.value,mode);done()}catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;form.elements.secret.select()}};form.elements.secret.focus();};paint();return;
  }
  const choices=['adventurers','robots','pixel','portraits','shapes'].flatMap(theme=>[0,1,2,3].map(n=>theme+'-'+n+'.svg'));
  const values={name:user.name||user.handle||'',password:'',confirm:'',passcode:'',confirmCode:'',avatar:choices[0]};let step=0,avatarTheme='all';
  const steps=[
   {title:'Hello.',copy:'Welcome to VELA Desktop.',kind:'hello'},
   {title:'What should we call you?',copy:'Choose a name for your desktop.',kind:'name'},
   {title:'Create a password',copy:'Use this password to unlock your desktop.',kind:'password'},
   {title:'Create a passcode',copy:'A quicker way to unlock. Choose 4–8 digits.',kind:'passcode'},
   {title:'Choose your picture',copy:'This is how you’ll appear in your desktop apps.',kind:'picture'},
   {title:'You’re all set.',copy:'Your desktop is ready.',kind:'ready'}
  ];
  function content(kind){
   if(kind==='hello')return `<div class="pc-hello-mark">${mark}</div>`;
   if(kind==='name')return `<div class="pc-user-symbol" aria-hidden="true"><svg viewBox="0 0 96 96" fill="none"><circle cx="48" cy="31" r="17" stroke="currentColor" stroke-width="3"/><path d="M16 86V76a32 32 0 0 1 64 0v10" stroke="currentColor" stroke-width="3"/></svg></div><label class="sr-only" for="desktop-name">Username</label><input id="desktop-name" name="username" value="${e(values.name)}" placeholder="Username" maxlength="32" autocomplete="nickname" required>`;
   if(kind==='password')return `<div class="pc-step-symbol" aria-hidden="true"><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="18" y="34" width="44" height="36" rx="7"/><path d="M27 34V23a13 13 0 0 1 26 0v11"/><circle cx="40" cy="51" r="3"/><path d="M40 54v7"/></svg></div><div class="pc-input-group"><label class="sr-only" for="desktop-password">Desktop password</label><input id="desktop-password" name="password" type="password" minlength="8" value="${e(values.password)}" autocomplete="new-password" required placeholder="Password"><label class="sr-only" for="desktop-confirm">Confirm password</label><input id="desktop-confirm" name="confirm" type="password" minlength="8" value="${e(values.confirm)}" autocomplete="new-password" required placeholder="Confirm password"></div><small class="pc-field-hint">At least 8 characters</small>`;
   if(kind==='passcode')return `<div class="pc-passcode-symbol" aria-hidden="true">${Array.from({length:6},()=>'<i></i>').join('')}</div><div class="pc-input-group"><label class="sr-only" for="desktop-passcode">Passcode</label><input id="desktop-passcode" name="passcode" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" value="${e(values.passcode)}" required placeholder="Passcode"><label class="sr-only" for="desktop-confirm-code">Confirm passcode</label><input id="desktop-confirm-code" name="confirmCode" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" value="${e(values.confirmCode)}" required placeholder="Confirm passcode"></div>`;
   if(kind==='picture')return `<img class="pc-profile-picture pc-picture-preview" src="${e(profilePicture({avatar:values.avatar}))}" alt="Selected profile picture"><div class="pc-avatar-grid">${choices.map((name,i)=>`<button type="button" data-avatar="${name}" aria-label="Profile picture ${i+1}" aria-pressed="${values.avatar===name}"><img src="${assetURL('avatars/'+name)}" alt=""></button>`).join('')}</div><label class="pc-upload">Choose a photo<input type="file" name="picture" accept="image/png,image/jpeg,image/webp" hidden></label>`;
   return `<img class="pc-profile-picture pc-ready-picture" src="${e(profilePicture({avatar:values.avatar}))}" alt=""><strong class="pc-ready-name">${e(values.name)}</strong><div class="pc-ready-apps"><img src="${assetURL('vela-mark.svg')}" alt="Chat"><img src="${assetURL('app-icons/store.svg')}" alt="App Store"><img src="${assetURL('app-icons/netflix-symbol.png')}" alt="Netflix"></div>`;
  }
  function retain(form){if(form.elements.username)values.name=form.elements.username.value;for(const name of ['password','confirm','passcode','confirmCode'])if(form.elements[name])values[name]=form.elements[name].value;}
  function paint(){
   const current=steps[step];screen.innerHTML=`<div class="pc-setup-systembar"><span>${mark}<span>VELA</span></span><span>Desktop setup</span></div><form class="pc-setup" data-setup-step="${current.kind}"><header><h1>${current.title}</h1><p>${current.copy}</p></header><div class="pc-step-content">${content(current.kind)}</div><p class="pc-form-error" role="alert"></p><button class="pc-primary" type="submit">${step===0?'Get started':step===steps.length-1?'Open desktop':'Continue'}</button>${step?'<button class="pc-text" type="button" data-back>Back</button>':''}</form><div class="pc-setup-bottom"><span>${current.kind==='password'||current.kind==='passcode'?'For this desktop on this browser. Your VELA sign-in stays the same.':''}</span><div aria-label="Setup progress">${steps.map((_,i)=>`<i class="${i===step?'active':''}"></i>`).join('')}</div></div>`;
   const form=screen.querySelector('form');form.querySelector('[data-back]')?.addEventListener('click',()=>{retain(form);step--;paint()});
   form.querySelectorAll('[data-avatar]').forEach(button=>button.onclick=()=>{values.avatar=button.dataset.avatar;form.querySelector('.pc-picture-preview').src=profilePicture(values);form.querySelectorAll('[data-avatar]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))});
   if(form.elements.picture)form.elements.picture.onchange=async()=>{const file=form.elements.picture.files[0];if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose a PNG, JPEG, or WebP picture under 8 MB.');const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=canvas.height=160;const side=Math.min(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,160,160);bitmap.close();values.avatar=canvas.toDataURL('image/webp',.85);form.querySelector('.pc-picture-preview').src=values.avatar;form.querySelectorAll('[data-avatar]').forEach(b=>b.setAttribute('aria-pressed','false'));}catch(error){form.querySelector('[role=alert]').textContent=error.message}};
   form.onsubmit=async event=>{event.preventDefault();retain(form);const button=form.querySelector('[type=submit]');try{
    if(current.kind==='name'&&!values.name.trim())throw Error('Enter a username.');
    if(current.kind==='password'&&values.password!==values.confirm)throw Error('Your passwords do not match.');
    if(current.kind==='passcode'&&values.passcode!==values.confirmCode)throw Error('Your passcodes do not match.');
    if(step===steps.length-1){button.disabled=true;button.textContent='Setting up…';await saveDesktopProfile(uid,values);values.password=values.confirm=values.passcode=values.confirmCode='';done();}else{step++;paint()}
   }catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;button.textContent=current.kind==='ready'?'Open desktop':'Continue';}};
   requestAnimationFrame(()=>form.querySelector('input:not([type=file]),[type=submit]')?.focus({preventScroll:true}));
  }
  paint();
 });
}

