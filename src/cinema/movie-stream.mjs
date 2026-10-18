// Converted uploads use fragmented MP4. Native file playback scans every fragment
// to calculate duration; MediaSource consumes the same bytes without that scan.
const mediaSourceClass=()=>globalThis.MediaSource||globalThis.ManagedMediaSource;
const sessions=new WeakMap(),cache=new Map(),BLOCK=2**20;
const type=(b,p)=>String.fromCharCode(...b.subarray(p,p+4));
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
export function mp4Boxes(b,start=0,end=b.length){const d=view(b),out=[];for(let p=start;p+8<=end;){let size=d.getUint32(p),header=8;if(size===1){if(p+16>end)break;size=Number(d.getBigUint64(p+8));header=16;}if(size===0)size=end-p;if(size<header||p+size>end)break;out.push({type:type(b,p+4),start:p,data:p+header,end:p+size,size});p+=size;}return out;}
const child=(b,box,name)=>box&&mp4Boxes(b,box.data,box.end).find(x=>x.type===name);
export function compactMovieInit(bytes){
 const moov=mp4Boxes(bytes).find(box=>box.type==='moov');if(!moov)return bytes;
 // Cover art and descriptive tags are not decoding tracks. Excluding them
 // from the in-memory streaming init also avoids exposing a PNG cover-art
 // stream to stricter mobile parsers. Original file/fragment offsets stay
 // unchanged: this is only the buffer sent to the media decoder.
 const children=mp4Boxes(bytes,moov.data,moov.end).filter(box=>!['udta','meta'].includes(box.type));
 const size=moov.data-moov.start+children.reduce((sum,box)=>sum+box.size,0);
 if(size===moov.size)return bytes;const result=new Uint8Array(moov.start+size);result.set(bytes.subarray(0,moov.data));const d=view(result);
 if(moov.data-moov.start===16)d.setBigUint64(moov.start+8,BigInt(size));else d.setUint32(moov.start,size);
 let at=moov.data;for(const box of children){result.set(bytes.subarray(box.start,box.end),at);at+=box.size;}return result;
}
export function inspectMp4(b){const moov=mp4Boxes(b).find(x=>x.type==='moov');if(!moov||!child(b,moov,'mvex'))return null;const tracks=[],d=view(b);for(const trak of mp4Boxes(b,moov.data,moov.end).filter(x=>x.type==='trak')){const tk=child(b,trak,'tkhd'),mdia=child(b,trak,'mdia'),md=child(b,mdia,'mdhd'),hd=child(b,mdia,'hdlr'),st=child(b,child(b,child(b,mdia,'minf'),'stbl'),'stsd');const entry=mp4Boxes(b,st.data+8,st.end)[0],kind=type(b,hd.data+8);let codec;if(entry.type==='avc1'||entry.type==='avc3'){const avc=mp4Boxes(b,entry.data+78,entry.end).find(x=>x.type==='avcC');if(avc)codec=entry.type+'.'+[...b.subarray(avc.data+1,avc.data+4)].map(x=>x.toString(16).padStart(2,'0')).join('');}else if(entry.type==='mp4a')codec='mp4a.40.2';else return null;tracks.push({id:d.getUint32(tk.data+(b[tk.data]===1?20:12)),scale:d.getUint32(md.data+(b[md.data]===1?20:12)),kind,codec});}if(tracks.some(t=>!t.codec))return null;return {init:b.slice(0,moov.end),offset:moov.end,tracks,mime:'video/mp4; codecs="'+tracks.map(t=>t.codec).join(',')+'"'};}
export function readFragmentIndex(b,tracks){if(b.length<16||type(b,b.length-12)!=='mfro')return null;const d=view(b),size=d.getUint32(b.length-4);if(size>b.length||size<16)return null;const mfra=mp4Boxes(b,b.length-size)[0];if(!mfra||mfra.type!=='mfra')return null;const indices=[];for(const box of mp4Boxes(b,mfra.data,mfra.end).filter(x=>x.type==='tfra')){const p=box.data,track=tracks.find(t=>t.id===d.getUint32(p+4));if(!track)continue;const wide=b[p]===1,lengths=d.getUint32(p+8),extra=((lengths>>4)&3)+1+((lengths>>2)&3)+1+(lengths&3)+1,count=d.getUint32(p+12);let q=p+16,entries=[];for(let n=0;n<count;n++){if(q+(wide?16:8)+extra>box.end)throw Error('Invalid movie fragment index');const time=wide?Number(d.getBigUint64(q)):d.getUint32(q);q+=wide?8:4;const offset=wide?Number(d.getBigUint64(q)):d.getUint32(q);q+=(wide?8:4)+extra;entries.push({time:time/track.scale,offset});}indices.push({track,entries});}return indices.find(x=>x.track.kind==='vide')?.entries||indices[0]?.entries||null;}
export function initializationEnd(b){
 const d=view(b);for(let p=0;p+8<=b.length;){let size=d.getUint32(p),header=8;if(size===1){if(p+16>b.length)return null;size=Number(d.getBigUint64(p+8));header=16;}if(!Number.isSafeInteger(size)||size<header)return null;const name=type(b,p+4);if(name==='moov')return p+size;if(name==='mdat'||p+size>b.length)return null;p+=size;}return null;
}
async function range(url,start,end,signal){const response=await fetch(url,{headers:{Range:`bytes=${start}-${end}`},signal});if(response.status!==206)throw Error('Movie server did not return a byte range');const size=Number(response.headers.get('Content-Range')?.split('/')[1]);return {bytes:new Uint8Array(await response.arrayBuffer()),size};}
export function warmMovie(url){if(!url||!mediaSourceClass())return Promise.resolve(null);let entry=cache.get(url);if(entry)return entry;entry=(async()=>{
 let head=await range(url,0,BLOCK-1);const end=initializationEnd(head.bytes);
 // Embedded cover art can make moov exceed the old 1 MB probe. Treating
 // those fragmented files as native forces a scan of every film fragment.
 if(end>head.bytes.length&&end<=Math.min(head.size,64*BLOCK)){const rest=await range(url,head.bytes.length,end-1);const bytes=new Uint8Array(end);bytes.set(head.bytes);bytes.set(rest.bytes,head.bytes.length);head={bytes,size:head.size};}
 const info=inspectMp4(head.bytes);if(!info||!mediaSourceClass().isTypeSupported(info.mime))return null;
 const tail=await range(url,Math.max(0,head.size-512*1024),head.size-1);let index=null;try{index=readFragmentIndex(tail.bytes,info.tracks);}catch{}
 return {...info,init:compactMovieInit(info.init),head:head.bytes,size:head.size,index};
 })().catch(error=>{cache.delete(url);throw error;});cache.set(url,entry);while(cache.size>3)cache.delete(cache.keys().next().value);return entry;}
export const movieSource=video=>video?.dataset?.movieSource||video?.src||'';
export function invalidateMovieCache(url){cache.delete(url);}
export async function playMovie(video){const epoch=video.__moviePlayEpoch||0,session=sessions.get(video);if(session){await session.ready;if(sessions.get(video)!==session||session.abort.signal.aborted||(video.__moviePlayEpoch||0)!==epoch)throw new DOMException('Playback cancelled','AbortError');}return video.play();}
export function stopMovie(video){if(!video)return;const session=sessions.get(video);session?.abort.abort();session?.dispose?.();sessions.delete(video);video.pause();video.removeAttribute('src');if(video.dataset)delete video.dataset.movieSource;video.load();}
export function loadMovie(video,url){stopMovie(video);const abort=new AbortController(),session={abort};sessions.set(video,session);video.dataset.movieSource=url;video.preload='auto';
 video.dataset.moviePhase='metadata';delete video.dataset.movieError;delete video.dataset.movieMime;
 // Keep play() pending while probing, then use native playback for ordinary files.
 const active=()=>sessions.get(video)===session&&!abort.signal.aborted;
 session.ready=(async()=>{let info;try{info=await warmMovie(url);}catch(error){if(!active())return;info=null;}if(!active())return;if(!info){video.dataset.moviePhase='native';video.src=url;video.load();return;}
 video.dataset.movieMime=info.mime;video.dataset.moviePhase='stream-open';
 const Source=mediaSourceClass();if(Source===globalThis.ManagedMediaSource)video.disableRemotePlayback=true;const media=new Source(),blob=URL.createObjectURL(media);session.dispose=()=>URL.revokeObjectURL(blob);video.src=blob;
 await new Promise(resolve=>{const done=()=>{media.removeEventListener('sourceopen',done);abort.signal.removeEventListener('abort',done);resolve();};media.addEventListener('sourceopen',done,{once:true});abort.signal.addEventListener('abort',done,{once:true});});if(!active())return;
 video.dataset.moviePhase='stream-buffer';const buffer=media.addSourceBuffer(info.mime);let offset=info.offset,pending=info.head.slice(offset),fetchAt=info.head.length,working=false,epoch=0,ended=false;
 const append=bytes=>new Promise((resolve,reject)=>{if(!active())return resolve();const cleanup=()=>{buffer.removeEventListener('error',fail);buffer.removeEventListener('updateend',done);abort.signal.removeEventListener('abort',done);};const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Movie decoding failed'));};abort.signal.addEventListener('abort',done,{once:true});buffer.addEventListener('updateend',done,{once:true});buffer.addEventListener('error',fail,{once:true});try{buffer.appendBuffer(bytes);}catch(error){cleanup();reject(error);}});
 video.dataset.moviePhase='stream-init';
 await append(info.init);if(info.index?.length){const last=info.index.at(-1),previous=info.index.at(-2);media.duration=last.time+Math.max(1,last.time-(previous?.time||last.time-2));}
 video.dataset.moviePhase='stream-segments';
 const pump=async()=>{if(working||ended||!active()||buffer.updating)return;working=true;const generation=epoch;try{while(active()&&generation===epoch){let end=0;for(let n=0;n<buffer.buffered.length;n++)if(video.currentTime>=buffer.buffered.start(n)-.1&&video.currentTime<=buffer.buffered.end(n))end=buffer.buffered.end(n);if(end>video.currentTime+25)break;
 let boxes=mp4Boxes(pending),pairEnd=0;for(let i=0;i<boxes.length;i++){if(boxes[i].type==='mdat'&&boxes.slice(0,i).some(x=>x.type==='moof'))pairEnd=boxes[i].end;}
 if(pairEnd){const bytes=pending.slice(0,pairEnd);pending=pending.slice(pairEnd);offset+=pairEnd;await append(bytes);continue;}
 if(fetchAt>=info.size){if(media.readyState==='open'&&!buffer.updating)media.endOfStream();ended=true;break;}
 const result=await range(url,fetchAt,Math.min(info.size-1,fetchAt+BLOCK-1),abort.signal);if(generation!==epoch)break;fetchAt+=result.bytes.length;const next=new Uint8Array(pending.length+result.bytes.length);next.set(pending);next.set(result.bytes,pending.length);pending=next;
 if(pending.length>64*BLOCK)throw Error('Movie fragment exceeds streaming limit');
 }}catch(error){if(active()&&error.name!=='AbortError')video.dispatchEvent(new CustomEvent('movie-stream-error',{detail:error}));}finally{working=false;if(active()&&generation!==epoch)pump();}};
 const seek=()=>{if(!info.index?.length||!active())return;const t=video.currentTime;for(let n=0;n<buffer.buffered.length;n++)if(t>=buffer.buffered.start(n)&&t<buffer.buffered.end(n)-.1)return;const item=[...info.index].reverse().find(x=>x.time<=t)||info.index[0];epoch++;ended=false;offset=item.offset;fetchAt=offset;pending=new Uint8Array();pump();};
 video.addEventListener('seeking',seek,{signal:abort.signal});video.addEventListener('timeupdate',()=>{if(!working&&!buffer.updating&&video.currentTime>70&&buffer.buffered.length&&buffer.buffered.start(0)<video.currentTime-65){buffer.remove(0,video.currentTime-60);buffer.addEventListener('updateend',pump,{once:true});}else if(!working&&!buffer.updating&&buffer.buffered.length&&buffer.buffered.end(buffer.buffered.length-1)>video.currentTime+90){buffer.remove(video.currentTime+60,buffer.buffered.end(buffer.buffered.length-1));buffer.addEventListener('updateend',pump,{once:true});}else pump();},{signal:abort.signal});
 // Start playback after the first fragment; fill the remaining buffer in parallel.
 media.addEventListener('startstreaming',pump,{signal:abort.signal});buffer.addEventListener('bufferedchange',pump,{signal:abort.signal});video.addEventListener('waiting',pump,{signal:abort.signal});
 pump();
 })().catch(error=>{if(active())video.dispatchEvent(new CustomEvent('movie-stream-error',{detail:error}));});return session.ready;
}
