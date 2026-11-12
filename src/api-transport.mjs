// The original Worker serves auth-critical requests when the GitHub Pages API
// gateway is unavailable. Only idempotent operations are eligible for retry.
const retryStatuses=new Set([502,503,504,520,522,523,524]);
const corePaths=new Set(['/me','/state','/session']);
export async function requestApiWithRecovery(path,init,{primaryOrigin,fallbackOrigin='',fetcher=fetch}){
 const method=(init?.method||'GET').toUpperCase();
 const safelyRetryable=method==='GET'||method==='HEAD'||path==='/me'&&method==='PUT'||path==='/session'&&(method==='POST'||method==='DELETE');
 const hasFallback=Boolean(fallbackOrigin&&fallbackOrigin!==primaryOrigin&&safelyRetryable);
 const primary=primaryOrigin.replace(/\/$/,'')+'/api'+path;
 const direct=hasFallback?fallbackOrigin.replace(/\/$/,'')+'/api'+path:'';
 const targets=direct&&corePaths.has(path)?[direct,primary]:[primary,...(direct?[direct]:[])];
 let lastError;
 for(let i=0;i<targets.length;i++){
  try{
   const response=await fetcher(targets[i],init);
   if(retryStatuses.has(response.status)&&i<targets.length-1){lastError=Error('Server temporarily unavailable.');continue;}
   return response;
  }catch(error){
   if(init?.signal?.aborted||error?.name==='AbortError')throw error;
   lastError=error;
  }
 }
 throw new Error('Cannot reach Vela right now. Your account is still signed in. Please retry.',{cause:lastError});
}
