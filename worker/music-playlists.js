import {normalizeSong} from '../src/song-model.mjs';
export const playlistSchema=[
 'CREATE TABLE IF NOT EXISTS music_playlists(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT "",created INTEGER NOT NULL,updated INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1)',
 'CREATE INDEX IF NOT EXISTS music_playlists_owner ON music_playlists(owner)',
 'CREATE TABLE IF NOT EXISTS music_playlist_members(playlist TEXT NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,uid TEXT NOT NULL,PRIMARY KEY(playlist,uid))',
 'CREATE INDEX IF NOT EXISTS music_playlist_member_uid ON music_playlist_members(uid,playlist)',
 'CREATE TABLE IF NOT EXISTS music_playlist_tracks(playlist TEXT NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL,added_by TEXT NOT NULL,added INTEGER NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(playlist,id))'
];
const ready=new WeakSet();
export async function musicPlaylistsAPI(req,env,uid,h){
 const url=new URL(req.url),match=url.pathname.match(/^\/api\/music-playlists(?:\/([a-f0-9-]{36})(?:\/(tracks|members)(?:\/([^/]+))?)?)?$/);
 if(!url.pathname.startsWith('/api/music-playlists'))return null;
 if(!match)return h.json({error:'Playlist not found.'},404);
 if(!ready.has(env)){await env.DB.batch(playlistSchema.map(sql=>env.DB.prepare(sql)));ready.add(env)}
 const {row,rows,fail,body,json}=h,[,id,section,rawKey]=match,key=rawKey?decodeURIComponent(rawKey):null;
 const friend=async(a,b)=>a===b||!!await row(env,"SELECT 1 FROM friends WHERE status='accepted' AND ((a=? AND b=?) OR (a=? AND b=?)) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (uid=? AND target=?) OR (uid=? AND target=?))",a,b,b,a,a,b,b,a);
 const change=()=>env.DB.prepare('UPDATE music_playlists SET updated=?,revision=revision+1 WHERE id=?').bind(Date.now(),id);
 async function playlistAccess(){const p=await row(env,'SELECT p.* FROM music_playlists p JOIN music_playlist_members m ON m.playlist=p.id WHERE p.id=? AND m.uid=?',id,uid);if(!p||!await friend(uid,p.owner))fail('Playlist not found.',404);return p}
 async function broadcast(pid){if(!h.notify)return;const members=await rows(env,'SELECT uid FROM music_playlist_members WHERE playlist=?',pid);await Promise.all(members.map(member=>h.notify(env,member.uid,{type:'music-playlist-updated',id:pid})))}
 async function details(p){const people=await rows(env,'SELECT u.uid,u.name,u.handle,u.avatar FROM music_playlist_members m JOIN users u ON u.uid=m.uid WHERE m.playlist=? ORDER BY m.uid=? DESC,u.name',p.id,p.owner);const items=await rows(env,'SELECT * FROM music_playlist_tracks WHERE playlist=? ORDER BY position,added,id LIMIT 500',p.id);return {...p,members:people,tracks:items.map(item=>({...JSON.parse(item.data),key:item.id,addedBy:item.added_by,added:item.added}))}}
 if(!id){
  if(req.method==='GET'){
   const list=await rows(env,'SELECT p.*,(SELECT COUNT(*) FROM music_playlist_tracks t WHERE t.playlist=p.id) AS count,(SELECT COUNT(*) FROM music_playlist_members n WHERE n.playlist=p.id) AS memberCount FROM music_playlists p JOIN music_playlist_members m ON m.playlist=p.id WHERE m.uid=? ORDER BY p.updated DESC LIMIT 100',uid);
   const visible=[];for(const p of list)if(await friend(uid,p.owner))visible.push(p);return json({items:visible});
  }
  if(req.method==='POST'){
   const data=await body(req),name=String(data.name||'').trim().slice(0,80);if(!name)fail('Give your playlist a name.');
   if((await row(env,'SELECT COUNT(*) AS n FROM music_playlists WHERE owner=?',uid)).n>=100)fail('You can create up to 100 playlists.');
   const members=[...new Set([uid,...(Array.isArray(data.members)?data.members:[])])];if(members.length>10)fail('Choose up to 9 friends.');
   for(const member of members)if(typeof member!=='string'||!await friend(uid,member))fail('Only your current friends can collaborate.',403);
   const pid=crypto.randomUUID(),now=Date.now();await env.DB.batch([env.DB.prepare('INSERT INTO music_playlists(id,owner,name,description,created,updated) VALUES(?,?,?,?,?,?)').bind(pid,uid,name,String(data.description||'').slice(0,500),now,now),...members.map(member=>env.DB.prepare('INSERT INTO music_playlist_members(playlist,uid) VALUES(?,?)').bind(pid,member))]);await broadcast(pid);return json(await details(await row(env,'SELECT * FROM music_playlists WHERE id=?',pid)),201);
  }
  fail('Method not allowed.',405);
 }
 const playlist=await playlistAccess();
 if(!section){
  if(req.method==='GET')return json(await details(playlist));
  if(req.method==='PATCH'){
   if(playlist.owner!==uid)fail('Only the owner can rename this playlist.',403);const data=await body(req),name=String(data.name||'').trim().slice(0,80);if(!name)fail('Give your playlist a name.');await env.DB.batch([env.DB.prepare('UPDATE music_playlists SET name=?,description=? WHERE id=?').bind(name,String(data.description??playlist.description).slice(0,500),id),change()]);await broadcast(id);return json(await details({...playlist,name}));
  }
 }else if(section==='members'){
  if(req.method==='POST'){
   if(playlist.owner!==uid)fail('Only the owner can invite collaborators.',403);const data=await body(req);if(typeof data.uid!=='string'||!await friend(uid,data.uid))fail('Choose a current friend.',403);if((await row(env,'SELECT COUNT(*) AS n FROM music_playlist_members WHERE playlist=?',id)).n>=10)fail('This playlist has 10 collaborators.');await env.DB.batch([env.DB.prepare('INSERT INTO music_playlist_members(playlist,uid) VALUES(?,?) ON CONFLICT DO NOTHING').bind(id,data.uid),change()]);await broadcast(id);return json(await details(playlist));
  }
  if(req.method==='DELETE'&&key){if(key===playlist.owner)fail('The playlist owner cannot leave.');if(uid!==playlist.owner&&key!==uid)fail('Only the owner can remove collaborators.',403);await env.DB.batch([env.DB.prepare('DELETE FROM music_playlist_members WHERE playlist=? AND uid=?').bind(id,key),change()]);await broadcast(id);return json({ok:true})}
 }else if(section==='tracks'){
  if(req.method==='POST'){
   const data=await body(req);let track=normalizeSong(data.track);
   if(!track&&data.track?.source==='local'&&/^[a-f0-9]{20}$/.test(data.track.id||'')&&typeof data.track.title==='string'&&data.track.title.trim())track={id:data.track.id,source:'local',title:data.track.title.trim().slice(0,200),artist:String(data.track.artist||'').slice(0,200),album:String(data.track.album||'').slice(0,200),duration:Math.max(0,Math.min(86400,Number(data.track.duration)||0))};
   if(!track)fail('Choose a valid song.');const trackKey=(track.source==='local'?'local:':'catalog:')+track.id;
   if((await row(env,'SELECT COUNT(*) AS n FROM music_playlist_tracks WHERE playlist=?',id)).n>=500)fail('This playlist has 500 songs.');
   await env.DB.batch([env.DB.prepare('INSERT INTO music_playlist_tracks(playlist,id,data,added_by,added,position) SELECT ?,?,?,?,?,COALESCE(MAX(position),-1)+1 FROM music_playlist_tracks WHERE playlist=? ON CONFLICT(playlist,id) DO NOTHING').bind(id,trackKey,JSON.stringify(track),uid,Date.now(),id),change()]);await broadcast(id);return json(await details(playlist));
  }
  if(req.method==='DELETE'&&key){await env.DB.batch([env.DB.prepare('DELETE FROM music_playlist_tracks WHERE playlist=? AND id=?').bind(id,key),change()]);await broadcast(id);return json(await details(playlist))}
 }
 fail('Method not allowed.',405);
}
