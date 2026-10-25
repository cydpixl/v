import {Input, BlobSource, ALL_FORMATS, Output, Mp4OutputFormat, StreamTarget, Conversion} from 'mediabunny';
import {registerAc3Decoder} from '@mediabunny/ac3';
import {registerDtsDecoder} from '@mediabunny/dts';
import {registerAacEncoder} from '@mediabunny/aac-encoder';

registerAc3Decoder();
registerDtsDecoder();
registerAacEncoder();
let conversion;
self.onmessage = async ({data}) => {
  if(data.type === 'cancel'){await conversion?.cancel();return;}
  if(data.type !== 'convert')return;
  let input, directory, output, writer;
  try {
    directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('connections-upload-files', {create:true});
    const handle = await directory.getFileHandle(data.key, {create:true});
    input = new Input({source:new BlobSource(data.file), formats:ALL_FORMATS});
    const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
    if(!video)throw Error('This video has no readable video track.');
    writer = await handle.createWritable();
    output = new Output({format:new Mp4OutputFormat({fastStart:'fragmented'}), target:new StreamTarget(new WritableStream({
      write: chunk => writer.write({type:'write',position:chunk.position,data:chunk.data}),
      close: () => writer.close(), abort: reason => writer.abort(reason),
    }), {chunked:true,chunkSize:2**20})});
    conversion = await Conversion.init({input,output,tracks:'primary',video:{codec:'avc'},audio:{codec:'aac'}});
    const lost = conversion.discardedTracks.filter(item => item.track===video || (audio && item.track===audio));
    if(!conversion.isValid || lost.length)throw Error('This video uses a codec your browser cannot convert. Convert this file with a desktop video editor and upload an MP4.');
    let last = 0;
    conversion.onProgress = progress => {const now=performance.now();if(now-last>200 || progress===1){last=now;self.postMessage({type:'progress',progress});}};
    await conversion.execute();
    const file = await handle.getFile();
    self.postMessage({type:'done',file,key:data.key});
  } catch(error) {
    await output?.cancel().catch(()=>{});
    await writer?.abort().catch(()=>{});
    await directory?.removeEntry(data.key).catch(()=>{});
    self.postMessage({type:'error',message:error.message});
  } finally {input?.dispose();conversion=null;}
};
