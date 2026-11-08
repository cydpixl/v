
import {api,uploadSubchunk} from './api';
export type UploadProvider='r2'|'b2';
export type UploadProgress=(percentage:number,message:string)=>void;
type Part={PartNumber:number;ETag:string};
type Session={provider:UploadProvider;key:string;uploadId:string;partBytes:number;chunkSize:number;parts:Part[]};
const supported=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','video/x-m4v'];
export async function sendLargeFile(file:File,provider:UploadProvider,animal:string,progress:UploadProgress,ownerKey:string){
  const ext=file.name.toLowerCase();
  const mime=file.type||(ext.endsWith('.mov')?'video/quicktime':ext.endsWith('.m4v')?'video/x-m4v':'');
  if(!supported.includes(mime))throw Error('Unsupported media format');
  const identity='newport-multipart-v3-'+provider+'-'+file.name+'-'+file.size+'-'+file.lastModified;
  let session:Session|null=null;
  try{
    const stored=localStorage.getItem(identity);
    if(stored)session=JSON.parse(stored) as Session;
  }catch{session=null;}
  if(!session||!session.chunkSize||!session.partBytes){
    progress(0,'Starting upload');
    const {data}=await api.post('/api/large/start',{provider,name:file.name,mime,size:file.size,ownerKey});
    session={provider,key:data.key,uploadId:data.uploadId,partBytes:Number(data.partBytes),
      chunkSize:Number(data.chunkSize),parts:[]};
    try{localStorage.setItem(identity,JSON.stringify(session));}catch{}
  }
  const task=session;
  if(!task.key||!task.uploadId||!task.partBytes||!task.chunkSize)throw Error('Invalid upload session');
  const numberOfParts=Math.ceil(file.size/task.partBytes);
  const completed=new Map<number,string>(task.parts.map(p=>[p.PartNumber,p.ETag]));
  const partial=new Map<number,number>();
  function completedBytes(){
    let sum=0;
    for(const number of completed.keys()){
      sum+=Math.min(task.partBytes,file.size-(number-1)*task.partBytes);
    }
    for(const [number,bytes] of partial){
      if(!completed.has(number))sum+=bytes;
    }
    return sum;
  }
  function notify(message:string){
    const percentage=Math.min(99,Math.floor(completedBytes()/file.size*100));
    progress(percentage,message);
  }
  const pending=Array.from({length:numberOfParts},(_,i)=>i+1).filter(p=>!completed.has(p));
  let cursor=0;
  async function worker(){
    while(cursor<pending.length){
      const number=pending[cursor++];
      const begin=(number-1)*task.partBytes;
      const end=Math.min(file.size,begin+task.partBytes);
      const subCount=Math.ceil((end-begin)/task.chunkSize);
      partial.set(number,0);
      for(let sub=0;sub<subCount;sub++){
        const start=begin+sub*task.chunkSize;
        const stop=Math.min(end,start+task.chunkSize);
        let lastError='';
        let success=false;
        for(let attempt=0;attempt<4&&!success;attempt++){
          try{
            await uploadSubchunk(task.key,task.uploadId,number,sub,file.slice(start,stop));
            success=true;
          }catch(e){
            lastError=e instanceof Error?e.message:'Transfer failed';
            if(attempt<3)await new Promise(r=>setTimeout(r,(attempt+1)*950));
          }
        }
        if(!success)throw Error(lastError+'. Re-select the same file to resume.');
        partial.set(number,stop-begin);
        notify('Uploading');
      }
      const {data}=await api.post('/api/large/commit-part',{key:task.key,uploadId:task.uploadId,
        partNumber:number,subCount});
      if(!data.etag)throw Error('Storage did not confirm part '+number);
      completed.set(number,String(data.etag));
      partial.delete(number);
      task.parts=[...completed].map(([PartNumber,ETag])=>({PartNumber,ETag})).sort((a,b)=>a.PartNumber-b.PartNumber);
      try{localStorage.setItem(identity,JSON.stringify(task));}catch{}
      notify('Uploading');
    }
  }
  await Promise.all(Array.from({length:Math.min(2,pending.length)},()=>worker()));
  progress(99,'Publishing to gallery');
  const parts=[...completed].map(([PartNumber,ETag])=>({PartNumber,ETag})).sort((a,b)=>a.PartNumber-b.PartNumber);
  await api.post('/api/large/finish',{provider,key:task.key,uploadId:task.uploadId,
    name:file.name,mime,size:file.size,animal,parts,ownerKey});
  try{localStorage.removeItem(identity);}catch{}
  progress(100,'Published');
}
