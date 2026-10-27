// XHR supplies byte progress and a bounded timeout for mobile multipart requests.
export function uploadRequest(url,{method,headers,body,signal,onUploadProgress}){
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open(method,url);xhr.timeout=120000;
  for(const [name,value]of Object.entries(headers))xhr.setRequestHeader(name,value);
  const abort=()=>xhr.abort(),finish=fn=>value=>{signal?.removeEventListener('abort',abort);fn(value);};
  const fail=finish(reject),done=finish(resolve);
  xhr.upload.onprogress=event=>onUploadProgress?.(event.loaded);
  xhr.onload=()=>done({ok:xhr.status>=200&&xhr.status<300,status:xhr.status,headers:new Headers({'Date':xhr.getResponseHeader('Date')||''}),json:async()=>JSON.parse(xhr.responseText||'{}')});
  xhr.onerror=()=>fail(Error('Upload connection interrupted. Retry in Uploads.'));
  xhr.ontimeout=()=>fail(Object.assign(Error('Upload timed out. Retry in Uploads to continue from the last saved part.'),{status:408}));
  xhr.onabort=()=>fail(new DOMException('Upload paused','AbortError'));
  if(signal?.aborted){fail(signal.reason||new DOMException('Upload paused','AbortError'));return;}
  signal?.addEventListener('abort',abort,{once:true});xhr.send(body);
 });
}
