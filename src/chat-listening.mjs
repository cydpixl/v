import {listeningFriends,followMusic} from './music-presence.js';
import {escape as e} from './util.js';
import {icon} from './icons.js';
import './listening-activity.css';
export const listeningLabel=uid=>`<small class="chat-listening-label" data-listening-user="${e(uid||'')}" hidden></small>`;
export function paintChatListening({avatar,toast}){
 const people=listeningFriends(),byId=new Map(people.map(person=>[person.uid,person]));
 for(const label of document.querySelectorAll('[data-listening-user]')){
  const music=byId.get(label.dataset.listeningUser)?.music;
  label.hidden=!music;label.textContent=music?'♫ '+music.title+' · '+music.artist:'';
  label.title=music?'Listening now: '+music.title+' by '+music.artist:'';
 }
 const aside=document.querySelector('.active-now');if(!aside)return;
 let activity=aside.querySelector('.chat-listening-activity');if(!activity){activity=document.createElement('section');activity.className='chat-listening-activity';activity.setAttribute('aria-label','Friends listening now');aside.querySelector('h2')?.after(activity)}
 activity.innerHTML=people.map(person=>`<article class="chat-listening-card">${avatar(person)}<div><strong>${e(person.name)}</strong><small>Listening now</small><span>${e(person.music.title)}</span><small>${e(person.music.artist)}</small>${person.music.trackId?`<button data-listen-friend="${e(person.uid)}">${icon('music',13)} Listen together</button>`:''}</div></article>`).join('');
 const quiet=aside.querySelector('.quiet-state');if(quiet)quiet.hidden=people.length>0;
 activity.querySelectorAll('[data-listen-friend]').forEach(button=>button.onclick=()=>followMusic(byId.get(button.dataset.listenFriend)).catch(error=>toast(error.message)));
}
