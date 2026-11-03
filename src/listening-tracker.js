// A play is recorded only after ten seconds of continuous observed playback.
// History is account scoped; prior devices cannot provide unobserved history.
export function createListeningTracker({api,self}){
 let account=null,sharing=false;const sources=new Map();
 function reset(){account=self();sharing=false;sources.clear();}
 async function setSharing(value){
  const owner=self();if(!owner)return;const previous=sharing;sharing=!!value;
  try{await api('/listening-history',{method:'POST',body:{shared:sharing}});}
  catch(error){if(self()===owner)sharing=previous;throw error;}
 }
 async function observe(track,shared=sharing){
  if(account!==self())reset();if(!account)return;
  sharing=!!shared;
  const now=Date.now(),key=track?.title?[track.title,track.artist].join('\0'):'';
  const source=['vela-card','library-player'].includes(track?.source)?track.source:'desktop';let current=sources.get(source);
  if(!track?.playing||!key){if(current)current.playingSince=0;return;}
  if(!current||current.signature!==key){current={signature:key,record:{id:crypto.randomUUID(),title:String(track.title).slice(0,200),artist:String(track.artist||'').slice(0,200),album:String(track.album||'').slice(0,200)},playingSince:now,lastWrite:0,busy:false};sources.set(source,current);}
  if(!current.playingSince)current.playingSince=now;
  if(now-current.playingSince<10000||now-current.lastWrite<60000||current.busy)return;
  const owner=account;current.busy=true;current.lastWrite=now;
  try{await api('/listening-history',{method:'POST',body:{shared:sharing,track:current.record}});}
  catch{/* Keep the local detector running; the next heartbeat retries. */}
  finally{if(self()===owner)current.busy=false;}
 }
 return {observe,setSharing,reset,shared:()=>sharing};
}
