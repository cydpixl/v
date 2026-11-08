
const FUNCTION_URL = 'https://newport-aquarium-r2-api.vercel.app/api';

const route=(url:string)=>{
  const path=url.split('?')[0];
  const qs=url.includes('?')?new URLSearchParams(url.split('?')[1]):new URLSearchParams();
  if(path==='/api/large/status')return {action:'status',qs};
  if(path==='/api/dupes/cleanup-new')return {action:'cleanup-new',qs};
  if(path==='/api/media')return {action:'media',qs};
  if(path==='/api/large/start')return {action:'start',qs};
  if(path==='/api/large/sign')return {action:'sign',qs};
  if(path==='/api/large/commit-part')return {action:'commit-part',qs};
  if(path==='/api/large/finish')return {action:'finish',qs};
  if(path==='/api/large/abort')return {action:'abort',qs};
  if(path==='/api/identify')return {action:'identify',qs};
  if(path==='/api/upload')return {action:'upload',qs};
  if(path==='/api/admin/check')return {action:'check',qs};
  const deleting=path.match(/^\/api\/media\/([^/]+)\/delete$/);
  if(deleting){qs.set('id',decodeURIComponent(deleting[1]));return {action:'delete',qs};}
  const editing=path.match(/^\/api\/media\/([^/]+)$/);
  if(editing){qs.set('id',decodeURIComponent(editing[1]));return {action:'update',qs};}
  throw new Error('Unknown gallery API: '+url);
};
async function call(method:'GET'|'POST',url:string,data?:any){
  const {action,qs}=route(url);
  qs.set('action',action);
  let result:Response;
  try {
    const target=action==='media'?'/api/gallery':
      action==='cleanup-new'?'/api/dedupe':
      ['check','update','delete'].includes(action)?'/api/manage':'/api';
    result=await fetch('https://newport-aquarium-r2-api.vercel.app'+target+'?'+qs.toString(),{
      method,headers:method==='POST'?{'Content-Type':'application/json'}:undefined,
      body:method==='POST'?JSON.stringify(data||{}):undefined,
    });
  }catch{
    throw new Error('Upload storage is not connected. Your files have not been transferred.');
  }
  const payload=await result.json().catch(()=>({error:'Storage server returned an invalid response.'}));
  if(!result.ok)throw Object.assign(new Error(payload.error||'Upload failed'),{response:{data:payload}});
  return {data:payload};
}
export const api={
  get:(url:string,data?:any)=>call('GET',url,data),
  post:(url:string,data?:any)=>call('POST',url,data),
  put:(url:string,data?:any)=>call('POST',url,data),
  delete:(url:string,data?:any)=>call('POST',url,data),
};


/** Upload one 3 MiB subchunk through the server-side R2 gateway.
 * File size is not limited by this subchunk size.
 */
export async function uploadSubchunk(
  key:string,uploadId:string,partNumber:number,sub:number,chunk:Blob
):Promise<void>{
  const query=new URLSearchParams({action:'chunk',key,uploadId,partNumber:String(partNumber),sub:String(sub)});
  let result:Response;
  try{
    result=await fetch(FUNCTION_URL+'?'+query.toString(),{
      method:'POST',headers:{'Content-Type':'application/octet-stream'},body:chunk
    });
  }catch{
    throw new Error('Upload connection interrupted. Re-select the same files to resume.');
  }
  const payload=await result.json().catch(()=>({error:'Invalid storage response'}));
  if(!result.ok||!payload.ok)throw new Error(payload.error||'Chunk upload failed');
}
