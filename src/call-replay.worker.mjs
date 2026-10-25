import {Input,BlobSource,ALL_FORMATS,Output,BufferTarget,Mp4OutputFormat,WebMOutputFormat,EncodedPacketSink,EncodedVideoPacketSource,EncodedAudioPacketSource,Conversion} from 'mediabunny';

self.onmessage=async({data})=>{
  const inputs=[];let joined,trimmed;
  try {
    const parts=data.parts;for(const part of parts)inputs.push(new Input({source:new BlobSource(part.blob),formats:ALL_FORMATS}));
    const firstVideo=await inputs[0].getPrimaryVideoTrack();if(!firstVideo)throw Error('The camera replay has no video.');
    const codec=await firstVideo.getCodec(),isMP4=codec==='avc'||codec==='hevc',type=isMP4?'video/mp4':'video/webm';
    const format=()=>isMP4?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat();
    const target=new BufferTarget(),output=new Output({target,format:format()});
    const video=new EncodedVideoPacketSource(codec);output.addVideoTrack(video);
    const firstAudio=await inputs[0].getPrimaryAudioTrack();
    const audio=firstAudio?new EncodedAudioPacketSource(await firstAudio.getCodec()):null;if(audio)output.addAudioTrack(audio);
    await output.start();let videoSequence=0,audioSequence=0;
    const base=parts[0].start;
    for(let index=0;index<inputs.length;index++){
      const input=inputs[index],offset=(parts[index].start-base)/1000,origin=await input.getFirstTimestamp();
      // Recorder finalization may include a frame at the next segment's start.
      // Keep one owner for each instant, avoiding overlapping GOP timestamps.
      const boundary=((parts[index+1]?.start??data.end)-base)/1000;
      const vt=await input.getPrimaryVideoTrack(),at=await input.getPrimaryAudioTrack();
      if(!vt||await vt.getCodec()!==codec)throw Error('The camera changed format. Try the clip again.');
      await Promise.all([
        (async()=>{const config=await vt.getDecoderConfig();for await(const packet of new EncodedPacketSink(vt).packets()){const timestamp=offset+packet.timestamp-origin;if(timestamp<boundary)await video.add(packet.clone({timestamp,duration:Math.min(packet.duration||1/30,boundary-timestamp),sequenceNumber:videoSequence++}),{decoderConfig:config});}})(),
        (async()=>{if(!audio||!at)return;const config=await at.getDecoderConfig();for await(const packet of new EncodedPacketSink(at).packets()){const timestamp=offset+packet.timestamp-origin;if(timestamp<boundary)await audio.add(packet.clone({timestamp,sequenceNumber:audioSequence++}),{decoderConfig:config});}})(),
      ]);
    }
    video.close();audio?.close();await output.finalize();
    joined=new Input({source:new BlobSource(new Blob([target.buffer],{type})),formats:ALL_FORMATS});
    const end=Math.min((data.end-base)/1000,await joined.computeDuration()),start=Math.max(0,end-data.seconds);
    if(end-start<.5)throw Error('Not enough camera footage is buffered yet.');
    const finalTarget=new BufferTarget();trimmed=new Output({target:finalTarget,format:format()});
    // Trim against the click time, including partial segments. Decoding and
    // encoding happens only when exporting, in this worker, never in the call UI.
    const conversion=await Conversion.init({input:joined,output:trimmed,tracks:'primary',trim:{start,end},video:{codec,forceTranscode:true,bitrate:2_500_000},audio:{copy:{mode:'preferred',boundaryPolicy:'shrink',boundaryTolerance:.03}}});
    if(!conversion.isValid)throw Error('This browser cannot prepare camera replays.');
    await conversion.execute();
    const result=finalTarget.buffer;self.postMessage({buffer:result,type,seconds:end-start},[result]);
  }catch(error){self.postMessage({error:error.message||'Could not prepare the replay.'});}
  finally{inputs.forEach(input=>input.dispose());joined?.dispose();}
};
