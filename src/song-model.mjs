const prefix='[[vela-song:1:';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function allowed(value,kind){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(kind==='audio'?url.hostname==='audio-ssl.itunes.apple.com':kind==='art'?/^(?:is\d+-ssl|is\d+)\.mzstatic\.com$/.test(url.hostname):url.hostname==='music.apple.com')?url.href:'';}catch{return '';}
}
export function normalizeSong(raw){
 if(!raw||!/^\d{5,18}$/.test(String(raw.id||''))||typeof raw.title!=='string'||!raw.title.trim())return null;
 const audio=allowed(raw.audio,'audio'),artwork=allowed(raw.artwork,'art'),url=allowed(raw.url,'link');
 if(!audio||!artwork||!url||[audio,artwork,url].some(value=>value.length>1400))return null;
 return {id:String(raw.id),title:raw.title.trim().slice(0,200),artist:String(raw.artist||'').slice(0,200),album:String(raw.album||'').slice(0,200),audio,artwork,url};
}
export function catalogSong(raw){return raw?.kind==='song'?normalizeSong({id:raw.trackId,title:raw.trackName,artist:raw.artistName,album:raw.collectionName,audio:raw.previewUrl,artwork:raw.artworkUrl100?.replace(/\/100x100bb\./,'/600x600bb.'),url:raw.trackViewUrl}):null;}
export function matchingSong(songs,track){
 const norm=value=>String(value||'').normalize('NFKD').replace(/\([^)]*\)|\[[^\]]*\]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 return songs.find(song=>norm(song.title)===norm(track.title)&&norm(song.artist)&&norm(track.artist)&&(norm(song.artist).includes(norm(track.artist))||norm(track.artist).includes(norm(song.artist))));
}
export function createSongMessage(raw){
 const song=normalizeSong(raw);if(!song)throw Error('This song is unavailable. Choose another version.');
 const token=prefix+btoa(Array.from(new TextEncoder().encode(JSON.stringify(song)),b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')+']]';
 if(token.length>3900)throw Error('This song has too much metadata to send.');return token;
}
export function parseSongMessage(value){
 if(typeof value!=='string'||value.length>3900||!/^\[\[vela-song:1:[A-Za-z0-9_-]+\]\]$/.test(value))return null;
 try{return normalizeSong(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value.slice(prefix.length,-2).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))));}catch{return null;}
}
export const playIcon='<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor"/></svg>';
export const pauseIcon='<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" fill="currentColor"/></svg>';
export function songMarkup(value){
 const song=parseSongMessage(value);if(!song)return null;
 return `<section class="song-card" data-song-token="${escape(value)}" aria-label="${escape(song.title+' by '+song.artist)}"><div class="song-card-top"><span>♫ Apple Music</span><a href="${escape(song.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escape(song.title)} in Apple Music">↗</a></div><div class="song-card-main"><img class="song-artwork" src="${escape(song.artwork)}" alt="${escape(song.album||song.title)} artwork" loading="lazy"><div class="song-card-details"><strong>${escape(song.title)}</strong><span>${escape(song.artist)}</span><small>${escape(song.album)}</small><button type="button" class="song-play" data-song-play aria-label="Play ${escape(song.title)}" aria-pressed="false">${playIcon}</button></div></div><div class="song-timeline"><input type="range" min="0" max="1000" value="0" step="1" data-song-seek aria-label="Song position" disabled><div><time data-song-elapsed>0:00</time><time data-song-duration>—</time></div></div><p class="song-error" role="status" hidden></p><audio preload="none" src="${escape(song.audio)}"></audio></section>`;
}
