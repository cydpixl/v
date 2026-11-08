
const FUNCTION_URL = 'https://jqzdszkkrdzmedkcnpzp.supabase.co/functions/v1/newport-public-gallery';

const route=(url:string)=>{
  const path=url.split('?')[0];
  const qs=url.includes('?')?new URLSearchParams(url.split('?')[1]):new URLSearchParams();
  if(path==='/api/large/status')return {action:'status',qs};
  if(path==='/api/media')return {action:'media',qs};
  if(path==='/api/large/start')return {action:'start',qs};
  if(path==='/api/large/sign')return {action:'sign',qs};
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
    result=await fetch(FUNCTION_URL+'?'+qs.toString(),{
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

/** Forward a signed multipart chunk via the private upload gateway.
 *  The browser never sends R2 credentials, and Cloudflare R2 CORS isn't needed.
 */
export async function proxyUploadChunk(signedUrl:string,chunk:Blob):Promise<string>{
  const form=new FormData();
  form.set('url',signedUrl);
  form.set('chunk',chunk,'part.bin');
  let result:Response;
  try{
    result=await fetch(FUNCTION_URL+'?action=chunk',{method:'POST',body:form});
  }catch{
    throw new Error('Upload gateway could not be reached. Check your connection and retry.');
  }
  const body=await result.json().catch(()=>({error:'Invalid response from upload gateway'}));
  if(!result.ok)throw new Error(body.error||'Upload chunk failed');
  if(!body.etag||typeof body.etag!=='string')throw new Error('Cloud storage did not confirm the chunk.');
  return body.etag;
}
