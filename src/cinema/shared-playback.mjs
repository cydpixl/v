import {movieSource,playMovie} from './movie-stream.mjs';
import {mediaTarget,syncCorrection} from './media-sync.mjs';

// One pending state per element: slow metadata must never accumulate old seeks.
const sessions=new WeakMap();
export function applySharedPlayback(video,state,{reason='heartbeat',sourceChanged=false,elapsedMs=0,rttMs=0,onBlocked=()=>{}}={}){
 let session=sessions.get(video);
 if(!session){
  session={state:null,attempt:0};sessions.set(video,session);
  for(const event of ['loadedmetadata','canplay','seeked'])video.addEventListener(event,()=>session.apply(false));
 }
 session.revision=(session.revision||0)+1;
 session.state={...state};session.received=performance.now();session.elapsedMs=elapsedMs;session.rttMs=rttMs;
 // A heartbeat may arrive while the new source is still probing metadata.
 // Retain the initial seek until the element can actually apply it.
 session.reason=reason==='heartbeat'&&session.reason?session.reason:reason;
 session.sourceChanged=sourceChanged||!!session.sourceChanged;session.onBlocked=onBlocked;
 video.__sharedPlayback=session;
 session.apply=(force=false)=>{
  const latest=session.state;if(!latest||movieSource(video)!==latest.url)return;
  clearTimeout(session.startTimer);
  if(latest.startAt&&Date.now()<latest.startAt&&latest.playing){video.pause();session.startTimer=setTimeout(()=>session.apply(),latest.startAt-Date.now());return;}
  if(video.readyState>=1&&Number.isFinite(video.duration)&&!video.seeking){
   const target=mediaTarget({position:Number(latest.position)||0,playing:latest.playing,elapsedMs:latest.startAt?Math.max(0,Date.now()-latest.startAt):session.elapsedMs+performance.now()-session.received,rttMs:latest.startAt?0:session.rttMs,duration:video.duration});
   const correction=syncCorrection({current:video.currentTime,target,reason:session.reason,sourceChanged:session.sourceChanged||force});
   // Avoid continually seeking while the requested frame is buffering.
   if(correction.seek!==null&&(session.reason!=='heartbeat'||session.sourceChanged||force||video.readyState>=3))video.currentTime=correction.seek;
   video.playbackRate=correction.rate;session.sourceChanged=false;session.reason='heartbeat';
  }
  if(!latest.playing){session.attempt++;video.__moviePlayEpoch=(video.__moviePlayEpoch||0)+1;video.pause();return;}
  if(video.paused&&!session.pending){
   const attempt=++session.attempt,revision=session.revision;session.pending=true;
   Promise.resolve(playMovie(video)).catch(error=>{
    if(attempt===session.attempt&&session.state?.playing&&error.name!=='AbortError')session.onBlocked(error);
   }).finally(()=>{session.pending=false;if(session.revision!==revision&&session.state?.playing&&video.paused)session.apply();});
  }
 };
 session.apply();
}
export function cancelSharedPlayback(video){
 const session=sessions.get(video);if(session){session.state=null;session.attempt++;clearTimeout(session.startTimer);}
 if(video){video.__moviePlayEpoch=(video.__moviePlayEpoch||0)+1;video.__sharedPlayback=null;video.playbackRate=1;}
}
export function resumeSharedPlayback(video){video.__sharedPlayback?.apply(true);return playMovie(video);}
