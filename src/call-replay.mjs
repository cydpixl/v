const SEGMENT_MS=2000,MAX_BYTES=40*1024*1024;
export const clipSeconds=settings=>[10,20,30,40,50,60].includes(Number(settings?.callClipSeconds))?Number(settings.callClipSeconds):10;

// Every segment is a complete native recording. Timeslice blobs alone are not
// independent video files and cannot safely be concatenated or pruned.
export class CallReplayBuffer {
  constructor({seconds=()=>10,onChange=()=>{}}={}) {
    this.seconds=seconds;this.onChange=onChange;this.parts=[];this.key='';this.stream=null;this.run=null;this.error='';this.failedKey='';
  }
  status() {
    const start=this.parts[0]?.start??this.run?.start;
    return {active:!!this.stream,seconds:start===undefined?0:Math.max(0,(performance.now()-start)/1000),bytes:this.parts.reduce((total,part)=>total+part.blob.size,0),segments:this.parts.length,error:this.error};
  }
  prune() {
    const oldest=performance.now()-(this.seconds()*1000+SEGMENT_MS);
    while(this.parts.length&&this.parts[0].end<oldest)this.parts.shift();
    let bytes=this.parts.reduce((total,part)=>total+part.blob.size,0);
    while(this.parts.length>1&&bytes>MAX_BYTES)bytes-=this.parts.shift().blob.size;
  }
  setSource(source,key) {
    if(!source){this.clear();this.failedKey='';this.error='';return;}
    if(key===this.key||key===this.failedKey)return;
    this.clear();
    this.key=key;this.error='';this.failedKey='';
    try {
      if(typeof MediaRecorder==='undefined')throw Error('This browser does not support camera replay.');
      const choices=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm;codecs=vp8','video/webm'];
      this.mime=choices.find(type=>MediaRecorder.isTypeSupported(type));if(!this.mime)throw Error('This browser does not support camera replay.');
      this.stream=new MediaStream(source.getTracks().filter(track=>track.readyState==='live').map(track=>track.clone()));
      this.startSegment();
    }catch(error){this.fail(error,key);}
  }
  fail(error,key=this.key) {
    this.clear();this.failedKey=key;this.error=error.message||'Camera replay is unavailable.';this.onChange();
  }
  startSegment() {
    if(!this.stream)return;
    const stream=this.stream,key=this.key,chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:this.mime,videoBitsPerSecond:2_500_000,audioBitsPerSecond:128_000});
    let resolve;const done=new Promise(yes=>resolve=yes);
    const run={recorder,start:performance.now(),done,resolve,timer:null};this.run=run;
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=event=>this.fail(event.error||Error('Camera replay recording failed.'),key);
    recorder.onstop=()=>{
      clearTimeout(run.timer);
      const part={blob:new Blob(chunks,{type:recorder.mimeType}),start:run.start,end:performance.now()};
      if(this.stream===stream&&this.run===run){this.run=null;if(part.blob.size)this.parts.push(part);this.prune();try{this.startSegment();}catch(error){this.fail(error,key);}}
      run.resolve(part);this.onChange();
    };
    recorder.start();run.timer=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},SEGMENT_MS);this.onChange();
  }
  async snapshot(seconds=this.seconds()) {
    const run=this.run,end=performance.now(),parts=this.parts.slice();
    if(!this.stream||!run||this.status().seconds<1)throw Error('The camera replay buffer is warming up. Try again in a moment.');
    clearTimeout(run.timer);if(run.recorder.state!=='inactive')run.recorder.stop();
    const part=await run.done;if(part.blob.size)parts.push(part);
    const recent=parts.filter(part=>part.end>=end-seconds*1000&&part.start<end);
    if(!recent.length)throw Error('No recent camera footage is available.');
    return {parts:recent,end,seconds};
  }
  clear() {
    const run=this.run;this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.key='';this.run=null;this.parts=[];
    if(run){clearTimeout(run.timer);try{if(run.recorder.state!=='inactive')run.recorder.stop();}catch{run.resolve({blob:new Blob(),start:run.start,end:performance.now()});}}
    this.onChange();
  }
}

export function makeReplayClip(snapshot) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./call-replay.worker.mjs',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>{worker.terminate();reject(Error('Preparing the replay took too long. Try again.'));},45000);
    const finish=()=>{clearTimeout(timeout);worker.terminate();};
    worker.onerror=event=>{finish();reject(Error(event.message||'Could not prepare the replay.'));};
    worker.onmessage=({data})=>{finish();if(data.error)reject(Error(data.error));else resolve({blob:new Blob([data.buffer],{type:data.type}),seconds:data.seconds});};
    worker.postMessage(snapshot);
  });
}
