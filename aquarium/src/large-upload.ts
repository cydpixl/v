
import { api } from './api';
export type UploadProvider = 'r2'|'b2';
export type UploadProgress = (percentage:number,message:string)=>void;
type Session={provider:UploadProvider;key:string;uploadId:string;partBytes:number;parts:Array<{PartNumber:number;ETag:string}>};
const allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','video/x-m4v'];
export async function sendLargeFile(file:File,provider:UploadProvider,animal:string,progress:UploadProgress,ownerKey:string){
  const mime=file.type || (file.name.toLowerCase().endsWith('.mov')?'video/quicktime':'');
  if(!allowed.includes(mime))throw Error('Unsupported format');
  const key='newport-multipart-v2-'+provider+'-'+file.name+'-'+file.size+'-'+file.lastModified;
  let current:Session|null=null;
  try{
    const saved=localStorage.getItem(key);
    if(saved)current=JSON.parse(saved) as Session;
  }catch{current=null;}
  if(!current){
    progress(0,'Starting multipart upload');
    const response=await api.post('/api/large/start',{provider,name:file.name,mime,size:file.size,ownerKey});
    current={provider,key:response.data.key,uploadId:response.data.uploadId,partBytes:Number(response.data.partBytes),parts:[]};
    try{localStorage.setItem(key,JSON.stringify(current));}catch{}
  }
  const session=current;
  const count=Math.ceil(file.size/session.partBytes);
  const saved=new Map<number,string>(session.parts.map(p=>[p.PartNumber,p.ETag]));
  const update=()=>{
    const bytes=[...saved.keys()].reduce((t,n)=>t+Math.min(session.partBytes,file.size-(n-1)*session.partBytes),0);
    progress(Math.floor(bytes/file.size*100),'Uploaded '+Math.floor(bytes/file.size*100)+'%');
  };
  update();
  const pending=Array.from({length:count},(_,i)=>i+1).filter(n=>!saved.has(n));
  let cursor=0;
  async function worker(){
    while(cursor<pending.length){
      const partNumber=pending[cursor++];
      const byte=(partNumber-1)*session.partBytes;
      const chunk=file.slice(byte,Math.min(byte+session.partBytes,file.size));
      let succeeded=false;
      let lastError='';
      for(let attempt=0;attempt<4&&!succeeded;attempt++){
        try{
          const {data}=await api.post('/api/large/sign',{provider,key:session.key,uploadId:session.uploadId,partNumber,ownerKey});
          const response=await fetch(String(data.url),{method:'PUT',body:chunk});
          if(!response.ok)throw Error('Storage returned HTTP '+response.status);
          const tag=response.headers.get('ETag');
          if(!tag)throw Error('Storage CORS must expose ETag');
          saved.set(partNumber,tag);
          session.parts=[...saved].map(([PartNumber,ETag])=>({PartNumber,ETag})).sort((a,b)=>a.PartNumber-b.PartNumber);
          try{localStorage.setItem(key,JSON.stringify(session));}catch{}
          update();
          succeeded=true;
        }catch(e){
          lastError=e instanceof Error?e.message:'Chunk failed';
          if(attempt<3)await new Promise(resolve=>setTimeout(resolve,(attempt+1)*800));
        }
      }
      if(!succeeded)throw Error(lastError+'. Reselect the same file and retry to resume.');
    }
  }
  await Promise.all(Array.from({length:Math.min(3,pending.length)},()=>worker()));
  progress(100,'Publishing to the gallery');
  await api.post('/api/large/finish',{provider,key:session.key,uploadId:session.uploadId,name:file.name,mime,size:file.size,animal,parts:session.parts,ownerKey});
  try{localStorage.removeItem(key);}catch{}
}
