export function syncCorrection({current,target,reason='heartbeat',sourceChanged=false}) {
 if(!Number.isFinite(current)||!Number.isFinite(target)||target<0)return {seek:null,rate:1};
 const drift=target-current;
 if(sourceChanged||['select','prepare','start','seek','pause','resync'].includes(reason))return {seek:Math.abs(drift)>.12?target:null,rate:1};
 // Heartbeats are observations, never user seeks. Delayed or buffering
 // peers must not rewind a healthy player. Explicit Resync handles jumps.
 return {seek:null,rate:Math.abs(drift)>.12?Math.max(.95,Math.min(1.05,1+drift*.08)):1};
}
export function mediaTarget({position,playing,elapsedMs=0,rttMs=0,duration=Infinity}) {
 const base=Number.isFinite(position)?Math.max(0,position):0;
 const elapsed=Number.isFinite(elapsedMs)?Math.max(0,elapsedMs):0;
 const delay=Number.isFinite(rttMs)?Math.min(1500,Math.max(0,rttMs))/2:0;
 return Math.min(Math.max(0,duration-.08),base+(playing?(elapsed+delay)/1000:0));
}
export function classifyMedia(file) {
 const extension=String(file.name||'').split('.').at(-1).toLowerCase();
 return /official.*music.?video/i.test(file.name||'')||String(file.type||'').startsWith('audio/')||['mp3','m4a','aac','wav','ogg','flac','opus'].includes(extension)?'song':'video';
}
