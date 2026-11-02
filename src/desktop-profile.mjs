import {assetURL} from './config.js';
const key=uid=>'vela.desktop.profile.'+uid;
export function desktopProfile(uid){try{return JSON.parse(localStorage.getItem(key(uid))||'null')}catch{return null}}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function digest(secret,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt.match(/../g).map(v=>parseInt(v,16))),iterations:210000},material,256)))}
export async function saveDesktopProfile(uid,{name,avatar,password,passcode}){
 name=String(name||'').trim();if(!name||name.length>32)throw Error('Choose a username with 1–32 characters.');
 if(password.length<8)throw Error('Use at least 8 characters for your desktop password.');
 if(!/^\d{4,8}$/.test(passcode))throw Error('Choose a 4–8 digit passcode.');
 if(!/^(?:adventurers|robots|pixel|portraits|shapes)-\d{1,2}\.svg$/.test(avatar)&&!/^data:image\/(png|jpeg|webp);base64,/.test(avatar))throw Error('Choose a profile picture.');
 if(avatar.length>500000)throw Error('Choose a smaller profile picture.');
 const salt=hex(crypto.getRandomValues(new Uint8Array(16))),profile={name,avatar,salt,password:await digest(password,salt),passcode:await digest(passcode,salt),created:Date.now()};
 localStorage.setItem(key(uid),JSON.stringify(profile));sessionStorage.setItem(key(uid)+'.unlocked','1');window.dispatchEvent(new CustomEvent('vela-desktop-profile',{detail:uid}));return profile;
}
export async function unlockDesktop(uid,secret,kind='passcode'){
 const profile=desktopProfile(uid);if(!profile)throw Error('Set up this desktop first.');
 const attemptKey=key(uid)+'.attempts';let attempts;try{attempts=JSON.parse(localStorage.getItem(attemptKey)||'null')}catch{}
 if(attempts?.until>Date.now())throw Error('Try again in '+Math.ceil((attempts.until-Date.now())/1000)+' seconds.');
 const actual=await digest(secret,profile.salt),expected=profile[kind];let difference=actual.length^String(expected).length;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^String(expected).charCodeAt(i);
 if(difference){const count=(attempts?.count||0)+1;localStorage.setItem(attemptKey,JSON.stringify({count,until:count>=5?Date.now()+30000:0}));throw Error('That '+kind+' is incorrect.');}
 localStorage.removeItem(attemptKey);sessionStorage.setItem(key(uid)+'.unlocked','1');return profile;
}
export const desktopUnlocked=uid=>sessionStorage.getItem(key(uid)+'.unlocked')==='1';
export function profilePicture(profile){return profile?.avatar?.startsWith('data:')?profile.avatar:assetURL('avatars/'+(profile?.avatar||'adventurers-0.svg'))}
export function lockDesktop(uid){sessionStorage.removeItem(key(uid)+'.unlocked');window.dispatchEvent(new CustomEvent('vela-desktop-lock',{detail:uid}));}
