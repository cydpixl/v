// Remove promotion labels while retaining musical versions (live, demo, remix).
export function cleanMusicTitle(value){
 return String(value||'').replace(/\.(mp3|m4a|aac|wav|ogg|flac)$/i,'').replace(/\s*\[[\w-]{11}\]\s*$/,'')
  .replace(/\s*[\[(][^\])]*(?:official\s*(?:audio|music\s*video|video|visuali[sz]er|lyric\s*video)|lyrics?\s*(?:video)?|\d{3,4}p|\d{3}hz)[^\])]*[\])]/gi,'')
  .replace(/\s+official\s+(?:audio|music video|video)\s*$/i,'').replace(/\s{2,}/g,' ').trim();
}
export function cleanMusicMetadata(track){
 let title=cleanMusicTitle(track.title||track.fileName),artist=String(track.artist||'').trim();
 if(!artist||/^(local music|unknown artist|uploaded audio)$/i.test(artist)){
  const parts=title.split(/\s+[–—-]\s+/);if(parts.length>1){artist=parts.shift();title=parts.join(' - ')}else artist='Unknown artist';
 }else if(title.toLowerCase().startsWith(artist.toLowerCase()+' - '))title=title.slice(artist.length+3);
 return {...track,title,artist};
}
export const fullSong=track=>!!(track?.blob?.size||track?.fullLength&&track?.audio);
export function localVersion(track,library){
 if(fullSong(track))return track;
 const norm=value=>String(value||'').normalize('NFKD').replace(/\([^)]*\)|\[[^\]]*\]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 return library.find(local=>fullSong(local)&&(local.catalogId===String(track.id)||norm(local.title)===norm(track.title)&&norm(local.artist)&&norm(local.artist)===norm(track.artist)))||track;
}
export function groupMusicGenres(tracks){
 const groups=new Map();for(const track of tracks){if(!track.genre)continue;if(!groups.has(track.genre))groups.set(track.genre,[]);groups.get(track.genre).push(track)}
 return [...groups].sort(([a],[b])=>a.localeCompare(b));
}
// Read text tags without decoding or loading the entire audio file.
export async function readMusicTags(file){
 if(!/\.mp3$/i.test(file.name))return {};
 const bytes=new Uint8Array(await file.slice(0,512*1024).arrayBuffer());
 if(bytes.length<10||String.fromCharCode(...bytes.slice(0,3))!=='ID3'||![3,4].includes(bytes[3]))return {};
 const sync=at=>((bytes[at]&127)<<21)|((bytes[at+1]&127)<<14)|((bytes[at+2]&127)<<7)|(bytes[at+3]&127);
 const uint=at=>new DataView(bytes.buffer).getUint32(at);
 const end=Math.min(bytes.length,10+sync(6)),tags={},fields={TIT2:'title',TPE1:'artist',TALB:'album',TCON:'genre'};
 let offset=10;if(bytes[5]&64)offset+=bytes[3]===4?sync(offset):4+uint(offset);
 while(offset+10<=end){const id=String.fromCharCode(...bytes.slice(offset,offset+4)),size=bytes[3]===4?sync(offset+4):uint(offset+4);if(!/^[A-Z0-9]{4}$/.test(id)||!size||offset+10+size>end)break;
  if(fields[id]&&size>1){const encoding=bytes[offset+10],data=bytes.slice(offset+11,offset+10+size);try{const text=new TextDecoder(encoding===0?'windows-1252':encoding===1?'utf-16':encoding===2?'utf-16be':'utf-8').decode(data).replace(/\0.*$/s,'').trim();if(text)tags[fields[id]]=text}catch{}}
  offset+=10+size;
 }
 return tags;
}
