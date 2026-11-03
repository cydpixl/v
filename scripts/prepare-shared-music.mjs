import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cleanMusicMetadata} from '../src/music-metadata.mjs';
if(!process.argv[2])throw Error('Pass the folder containing the supplied MP3 files.');
const directory=path.resolve(process.argv[2]),output='.private/shared-music';
fs.mkdirSync(output,{recursive:true});
const old=JSON.parse(fs.readFileSync('worker/default-music.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('public/imported-music.json','utf8')).tracks;
const tracks=[],uploads=[];
for(const name of fs.readdirSync(directory).filter(name=>/\.mp3$/i.test(name))){
 const file=path.join(directory,name),id=crypto.createHash('sha256').update(name).digest('hex').slice(0,20);
 const prior=old.find(t=>t.id===id),known=catalog.find(t=>t.id===id);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-of','json',file],{encoding:'utf8'}));
 const tags=probe.format.tags||{};
 const track=cleanMusicMetadata({...prior,...known,id,title:known?.title||prior?.title||tags.title||name,artist:known?.artist||prior?.artist||tags.artist||'',album:known?.album||prior?.album||tags.album||'',duration:Number(probe.format.duration),size:fs.statSync(file).size,index:prior?.index??21+tracks.length,fullLength:true,artwork:prior?.artwork||''});
 delete track.fileName;
 if(!prior?.artwork&&known?.artwork){
  const image=await fetch(known.artwork);if(!image.ok)throw Error('Artwork failed: '+track.title);
  const bytes=Buffer.from(await image.arrayBuffer());if(!image.headers.get('content-type')?.startsWith('image/'))throw Error('Invalid artwork');
  fs.writeFileSync('public/music-art/'+id+'.jpg',bytes);track.artwork=id+'.jpg';
 }
 if(!track.artwork){
  try{execFileSync('ffmpeg',['-v','error','-y','-i',file,'-an','-frames:v','1','public/music-art/'+id+'.jpg'],{stdio:'pipe'});track.artwork=id+'.jpg'}catch{}
 }
 tracks.push(track);if(!prior)uploads.push({id,file,title:track.title});
}
if(!tracks.length||old.some(track=>!tracks.some(item=>item.id===track.id)))throw Error('The supplied folder must preserve all existing shared songs.');
tracks.sort((a,b)=>a.index-b.index);tracks.forEach((track,index)=>track.index=index);
fs.writeFileSync(output+'/tracks.json',JSON.stringify(tracks,null,2)+'\n');
fs.writeFileSync(output+'/uploads.json',JSON.stringify(uploads,null,2)+'\n');
console.log(JSON.stringify({tracks:tracks.length,newUploads:uploads.length,artwork:tracks.filter(t=>t.artwork).length,bytes:tracks.reduce((n,t)=>n+t.size,0)}));
