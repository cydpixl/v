import {escape as e,avatar} from './util.js';
const endpoint='https://api.lanyard.rest/v1/users/';
export async function readPresence(id,signal){
 if(!/^\d{17,20}$/.test(id))throw Error('Enter your 17–20 digit Discord user ID.');
 const response=await fetch(endpoint+id,{signal:signal||AbortSignal.timeout(10000)});
 const result=await response.json();
 if(!response.ok||!result.success)throw Error('This account is not monitored yet. Join the Lanyard Discord server, then try again.');
 return result.data;
}
export function presenceMarkup(data){
 const person=data.discord_user||{},spotify=data.listening_to_spotify&&data.spotify,activity=data.activities?.find(a=>a.type!==4&&a.type!==2);
 const image=person.avatar?`https://cdn.discordapp.com/avatars/${person.id}/${person.avatar}.${person.avatar.startsWith('a_')?'gif':'png'}?size=128`:'';
 const status=['online','idle','dnd','offline'].includes(data.discord_status)?data.discord_status:'offline';
 return `<div class="discord-person">${avatar({name:person.global_name||person.username||'Discord',avatar:image,status})}<div><strong>${e(person.global_name||person.username||'Discord')}</strong><span><i class="discord-status ${status}"></i>${{online:'Online',idle:'Idle',dnd:'Do not disturb',offline:'Offline'}[status]}</span></div><span class="connection-live">Lanyard</span></div>${spotify?`<div class="discord-activity">${/^https:\/\/i\.scdn\.co\//.test(spotify.album_art_url)?`<img src="${e(spotify.album_art_url)}" alt="Album artwork">`:''}<div><small>Listening on Spotify</small><strong>${e(spotify.song)}</strong><span>${e(spotify.artist)}</span></div>${/^[A-Za-z0-9]+$/.test(spotify.track_id||'')?`<a href="https://open.spotify.com/track/${spotify.track_id}" target="_blank" rel="noopener noreferrer">Open track ↗</a>`:''}</div>`:activity?`<div class="discord-activity"><div><small>${activity.type===1?'Streaming':'Playing'}</small><strong>${e(activity.name)}</strong>${activity.details?`<span>${e(activity.details)}</span>`:''}${activity.state?`<span>${e(activity.state)}</span>`:''}</div></div>`:'<p class="discord-no-activity">No current activity.</p>'}`;
}
export function mountPresence(target,id){
 let stopped=false,busy=false,controller;target.innerHTML='<p>Loading Discord activity…</p>';
 const update=async()=>{if(stopped||busy||document.hidden)return;busy=true;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);try{const data=await readPresence(id,controller.signal);if(!stopped)target.innerHTML=presenceMarkup(data);}catch(error){if(!stopped)target.innerHTML=`<p role="status">${e(error.name==='AbortError'?'Discord activity timed out.':error.message)}</p>`;}finally{clearTimeout(timeout);busy=false;}};
 update();const interval=setInterval(update,30000);document.addEventListener('visibilitychange',update);
 return ()=>{stopped=true;controller?.abort();clearInterval(interval);document.removeEventListener('visibilitychange',update);};
}
export async function renderConnections(target,{api,uid,isCurrent=()=>true}){
 const {profile}=await api('/profile-extras/'+encodeURIComponent(uid));if(!target.isConnected||!isCurrent())return ()=>{};
 let stop=()=>{},disposed=false;
 target.innerHTML=`<h2>Connections</h2><p>Show your Discord status, game activity, and Spotify listening on your profile.</p><section class="discord-connection"><header><div><h3>Discord · Lanyard</h3><p>Connect with your Discord user ID.</p></div><span data-connection-state>${profile.discord?'Connected':'Not connected'}</span></header><div data-presence class="discord-presence" ${profile.discord?'':'hidden'}></div><form class="discord-connect-form"><label for="discord-user-id">Discord user ID</label><div><input id="discord-user-id" name="discord" inputmode="numeric" autocomplete="off" maxlength="20" value="${e(profile.discord||'')}" placeholder="e.g. 123456789012345678" aria-describedby="discord-setup"><button class="primary" type="submit">${profile.discord?'Update connection':'Connect Discord'}</button></div><p class="connection-error" role="alert" hidden></p></form><details id="discord-setup"><summary>How to connect</summary><ol><li>In Discord, enable Developer Mode under Advanced settings.</li><li>Right-click your profile and choose Copy User ID.</li><li><a href="https://discord.gg/lanyard" target="_blank" rel="noopener noreferrer">Join the Lanyard server ↗</a> so Lanyard can read your presence.</li><li>Paste your user ID above and connect.</li></ol><p>This links public activity by ID. It does not sign in to Discord or verify account ownership.</p></details><button class="text-button danger" data-disconnect ${profile.discord?'':'hidden'}>Disconnect Discord</button></section>`;
 const presence=target.querySelector('[data-presence]'),form=target.querySelector('form'),input=form.querySelector('input'),error=form.querySelector('[role=alert]'),submit=form.querySelector('button'),disconnect=target.querySelector('[data-disconnect]');
 if(profile.discord)stop=mountPresence(presence,profile.discord);
 form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;error.hidden=true;try{const id=input.value.trim(),data=await readPresence(id);if(disposed)return;await api('/profile-extras/'+encodeURIComponent(uid),{method:'PUT',body:{discord:id}});if(disposed)return;stop();presence.hidden=false;presence.innerHTML=presenceMarkup(data);stop=mountPresence(presence,id);target.querySelector('[data-connection-state]').textContent='Connected';submit.textContent='Update connection';disconnect.hidden=false;}catch(err){if(!disposed){error.textContent=err.name==='TimeoutError'?'Lanyard timed out. Try again.':err.message;error.hidden=false;}}finally{submit.disabled=false;}};
 disconnect.onclick=async()=>{disconnect.disabled=true;try{await api('/profile-extras/'+encodeURIComponent(uid),{method:'PUT',body:{discord:''}});if(disposed)return;stop();input.value='';presence.hidden=true;disconnect.hidden=true;target.querySelector('[data-connection-state]').textContent='Not connected';submit.textContent='Connect Discord';}catch(err){error.textContent=err.message;error.hidden=false;}finally{disconnect.disabled=false;}};
 return ()=>{disposed=true;stop();};
}
