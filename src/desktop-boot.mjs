import {escape as e} from './util.js';
import {desktopProfile,unlockDesktop,profilePicture} from './desktop-profile.mjs';
import './desktop-boot.css';
let screen,screenClock;
const mark='<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M92 106h91l73 201 73-201h91L307 411H205z" fill="currentColor"/><path d="M216 166h80l-40 113z" fill="currentColor"/></svg>';
function createScreen(label){const dialog=document.createElement('dialog');dialog.className='desktop-boot-screen';dialog.setAttribute('aria-label',label);dialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(dialog);dialog.showModal();return dialog;}
export function finishBoot(){clearInterval(screenClock);screen?.close();screen?.remove();screen=null;}
// VELA authentication is handled by the existing sign-in form.
// Desktop password/PIN setup is never required to enter the app.
// Previously configured desktop locks remain available only when a user explicitly locks it.
export async function enterDesktop({user,onDone=()=>{},forceLock=false}){
 const uid=user.uid,profile=desktopProfile(uid);
 if(!forceLock||!profile){finishBoot();onDone();return;}
 if(!screen?.isConnected)screen=createScreen('Unlock VELA Desktop');
 screen.removeAttribute('id');
 screen.dataset.phase='lock';
 return new Promise(resolve=>{
  const done=()=>{finishBoot();onDone();resolve()};
  clearInterval(screenClock);
  screenClock=setInterval(()=>{const clock=screen?.querySelector('.pc-lock-clock');if(clock){clock.querySelector('time').textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});clock.querySelector('p').textContent=new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}},1000);
  let mode='passcode';screen.style.setProperty('--lock-wallpaper','var(--custom-wallpaper,var(--wallpaper))');
  const paint=()=>{
   screen.innerHTML=`<div class="pc-lock-clock"><time>${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time><p>${new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'})}</p></div><form class="pc-unlock"><img class="pc-profile-picture" src="${e(profilePicture(profile))}" alt=""><h1>${e(profile.name)}</h1><label class="sr-only" for="desktop-unlock">${mode==='passcode'?'Passcode':'Desktop password'}</label><div class="pc-unlock-input"><input id="desktop-unlock" name="secret" type="password" ${mode==='passcode'?'inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8"':'autocomplete="current-password"'} placeholder="${mode==='passcode'?'Enter your passcode':'Enter your password'}" required><button type="submit" aria-label="Unlock desktop">→</button></div><p class="pc-form-error" role="alert"></p><button class="pc-text" type="button" data-mode>Use ${mode==='passcode'?'password':'passcode'}</button></form><span class="pc-lock-brand">${mark}<span>VELA</span></span>`;
   const form=screen.querySelector('form');
   form.querySelector('[data-mode]').onclick=()=>{mode=mode==='passcode'?'password':'passcode';paint()};
   form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await unlockDesktop(uid,form.elements.secret.value,mode);done()}catch(error){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;form.elements.secret.select()}};
   form.elements.secret.focus();
  };
  paint();
 });
}
