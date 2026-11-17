export const needsMovieConversion = file => /\.(mkv|mov)$/i.test(file.name);
export function convertMovie(file, key, {signal,onProgress=()=>{},fastStart='fragmented',keepCompatibleMp4=false}={}) {
  return new Promise((resolve,reject)=>{
    const worker = new Worker(new URL('./movie-conversion.worker.mjs',import.meta.url),{type:'module'});
    const stop = () => {worker.terminate();signal?.removeEventListener('abort',abort);};
    const abort = () => {stop();void releaseConvertedFile({conversionKey:key});reject(new DOMException('Conversion paused','AbortError'));};
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    worker.onerror = event => {stop();reject(Error(event.message || 'Video conversion failed.'));};
    worker.onmessage = ({data}) => {
      if(data.type==='progress')onProgress(data.progress);
      if(data.type==='original'){stop();resolve(file);}
      if(data.type==='done'){stop();const result=new File([data.file],file.name.replace(/\.[^.]+$/,'')+'.mp4',{type:'video/mp4',lastModified:file.lastModified});result.conversionKey=key;resolve(result);}
      if(data.type==='error'){stop();reject(Error(data.message));}
    };
    worker.postMessage({type:'convert',file,key,fastStart,keepCompatibleMp4});
  });
}

export async function prepareChatVideo(file,options={}){
  const convertContainer=needsMovieConversion(file);
  try{return await convertMovie(file,crypto.randomUUID(),{...options,keepCompatibleMp4:!convertContainer});}
  catch(error){
    if(options.signal?.aborted||convertContainer)throw error;
    options.onFallback?.();
    return file;
  }
}

export async function releaseConvertedFile(file){if(!file?.conversionKey)return;try{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('connections-upload-files');await dir.removeEntry(file.conversionKey);}catch{}}
