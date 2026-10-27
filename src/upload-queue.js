import {validateChatFile} from './media-policy.mjs';
import {escape as e,bytes} from './util.js';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('vela-upload-queue',2);r.onupgradeneeded=()=>{for(const name of ['jobs','files'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function store(action,value,name='jobs'){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(name,['getAll','get'].includes(action)?'readonly':'readwrite'),r=tx.objectStore(name)[action](value);let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||r.error||Error('Device storage write failed.'));tx.onabort=()=>reject(tx.error||r.error||Error('Device storage write was interrupted.'));});}finally{db.close();}}
function delay(ms,signal){return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Paused','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}
export function createUploadQueue({api,self,modal,toast,onReady}){
 const jobs=new Map(),running=new Set(),listeners=new Map();let owner=null,panel,loading=null;
 const list=()=>[...jobs.values()].filter(j=>j.uid===self()?.uid);
 const save=job=>{const {controller,file,...stored}=job;return store('put',stored);};
 async function saveFile(job){
  try{await store('put',{id:job.id,file:job.file},'files');}
  catch(error){
   if(error?.name==='QuotaExceededError')throw error;
   // Some WebKit versions cannot clone File/Blob into IndexedDB. ArrayBuffer is portable.
   await store('put',{id:job.id,bytes:await job.file.arrayBuffer(),name:job.name,type:job.type,lastModified:job.file.lastModified},'files');
  }
  job.persistedFile=true;
 }
 async function restoreFile(job){const saved=await store('get',job.id,'files');return saved?.file|| (saved?.bytes?new File([saved.bytes],saved.name,{type:saved.type,lastModified:saved.lastModified}):null);}

 const current=job=>job.uid===self()?.uid&&jobs.get(job.id)===job&&job.status!=='cancelled';
 const changed=()=>{draw();window.dispatchEvent(new CustomEvent('vela-upload-queue',{detail:list()}));};
 function settle(job,error,result){const waiting=listeners.get(job.id);listeners.delete(job.id);if(error)waiting?.reject(Object.assign(error,{uploadJob:job.id}));else waiting?.resolve(result);return !!waiting;}
 async function load(){
  const uid=self()?.uid;if(uid===owner&&loading)return loading;if(uid===owner)return;
  for(const job of jobs.values()){job.controller?.abort();settle(job,Error('Account changed. Your upload is saved in Uploads.'));}
  owner=uid;jobs.clear();
  const pending=(async()=>{const stored=await store('getAll');if(owner!==uid||self()?.uid!==uid)return;for(const job of stored)if(job.uid===uid){if(['uploading','queued'].includes(job.status)){job.status='paused';job.error='Paused after closing Vela. Resume to continue.';}jobs.set(job.id,job);}changed();})();
  loading=pending;try{await pending;}catch(error){if(owner===uid)owner=null;throw error;}finally{if(loading===pending)loading=null;}
 }
 async function add(file,conversation,{onProgress}={}){
  const uid=self()?.uid;if(!uid||!conversation)throw Error('Open a conversation first.');file=await validateChatFile(file);await load();if(self()?.uid!==uid)throw Error('Account changed. Select the file again.');
  const job={id:crypto.randomUUID(),uid,conversation,file,name:file.name,type:file.type||'application/octet-stream',size:file.size,status:'queued',progress:0,parts:[],created:Date.now()};
  try{await saveFile(job);await save(job);}catch(error){await store('delete',job.id,'files').catch(()=>{});throw Error('Vela could not save this file on your device. Free some device storage and try again.');}
  jobs.set(job.id,job);const result=new Promise((resolve,reject)=>listeners.set(job.id,{resolve,reject,onProgress}));pump();return result;
 }
 function pump(){for(const job of list()){if(running.size>=2)break;if(job.status==='queued'&&!running.has(job.id))void run(job);}}
 async function run(job){
  if(running.has(job.id)||!current(job))return;running.add(job.id);const controller=job.controller=new AbortController(),signal=controller.signal;job.status='uploading';job.error='';changed();
  const progress=value=>{if(!current(job)||signal.aborted)return;const next=Math.max(0,Math.min(100,Math.round(value)));if(next===job.progress)return;job.progress=next;listeners.get(job.id)?.onProgress?.(job.progress);changed();};
  try{
   if(job.file&&!job.persistedFile){await saveFile(job);await save(job);}
   if(!navigator.onLine)throw Error('You’re offline. Resume this upload when you reconnect.');
   if(!job.server){job.server=await api('/chat-uploads',{method:'POST',body:{conversation:job.conversation,name:job.name,type:job.type,size:job.size},signal});if(!current(job))return;await save(job);}
   const checkpoint=await api('/chat-uploads/'+job.server.id,{signal});let result=checkpoint.upload;
   if(!result){
    job.file||=await restoreFile(job);if(!job.file)throw Error('The saved file is no longer available on this device. Cancel this upload and select it again.');
    job.parts=checkpoint.parts||[];const partSize=checkpoint.partSize;if(!Number.isSafeInteger(partSize)||partSize<1)throw Error('The upload server returned an invalid checkpoint. Retry this upload.');
    for(let offset=0,n=1;offset<job.size;offset+=partSize,n++){
     signal.throwIfAborted();if(!current(job))return;
     if(!job.parts.some(p=>p.partNumber===n)){
      let part;for(let attempt=0;;attempt++){
       try{part=await api('/chat-uploads/'+job.server.id+'/part?n='+n,{method:'PUT',body:job.file.slice(offset,offset+partSize),signal,onUploadProgress:loaded=>progress((offset+loaded)/job.size*100)});break;}
       catch(error){if(signal.aborted||attempt===3||(error.status&&error.status<500&&![408,429].includes(error.status)))throw error;job.error='Connection interrupted. Retrying…';changed();await delay(error.status===429?30000:1000*2**attempt,signal);}
      }
      signal.throwIfAborted();if(!current(job))return;job.parts.push(part);await save(job);
     }
     job.error='';progress(Math.min(job.size,offset+partSize)/job.size*100);
    }
    job.error='Finishing upload…';changed();result=(await api('/chat-uploads/'+job.server.id+'/complete',{method:'POST',body:{},signal})).upload;
   }
   signal.throwIfAborted();if(!current(job))return;if(!result?.id)throw Error('Upload could not be finalized. Retry to check its status.');job.status='done';job.progress=100;job.error='';job.upload=result;job.file=null;await save(job);await store('delete',job.id,'files');
   if(!current(job))return;const waiting=settle(job,null,{upload:result});if(!waiting)await onReady?.(job,{explicit:false});changed();
  }catch(error){
   if(!current(job))return;job.status=signal.aborted?'paused':'failed';job.error=signal.aborted?'Paused. Resume to continue.':error.message;
   settle(job,Object.assign(Error(job.error),{code:signal.aborted?'UPLOAD_PAUSED':'UPLOAD_FAILED'}));try{await save(job);}catch{job.error+=' Device storage is full.';}changed();
  }finally{running.delete(job.id);if(job.controller===controller)job.controller=null;if(current(job))changed();pump();}
 }
 async function pause(job){job.status='paused';job.controller?.abort();settle(job,Object.assign(Error('Upload paused. Resume it in Uploads.'),{code:'UPLOAD_PAUSED'}));await save(job);changed();}
 async function cancel(job){job.status='cancelled';job.controller?.abort();settle(job,Object.assign(Error('Upload cancelled.'),{code:'UPLOAD_CANCELLED'}));jobs.delete(job.id);await store('delete',job.id);await store('delete',job.id,'files');changed();if(job.server&&!job.upload)await api('/chat-uploads/'+job.server.id,{method:'DELETE'}).catch(()=>{});}
 function draw(){
  if(!panel?.open)return;panel.querySelector('[data-queue-list]').innerHTML=list().map(job=>`<article class="queue-job"><strong>${e(job.name)}</strong><small>${bytes(job.size)} · ${e(job.error||job.status)} · ${job.progress}%</small><progress aria-label="${e(job.name)} upload progress" max="100" value="${job.progress}"></progress><div>${['uploading','queued'].includes(job.status)?`<button class="secondary" data-job="${job.id}" data-op="pause">Pause</button>`:['paused','failed'].includes(job.status)?`<button class="primary" ${running.has(job.id)?'disabled':''} data-job="${job.id}" data-op="resume">${job.status==='failed'?'Retry':'Resume'}</button>`:job.status==='done'?`<button class="secondary" data-job="${job.id}" data-op="attach">Attach in chat</button>`:''}<button class="text-button" data-job="${job.id}" data-op="cancel">${job.status==='done'?'Dismiss':'Cancel'}</button></div></article>`).join('')||'<p>No uploads. Choose a file from the + button in a conversation.</p>';
  panel.querySelectorAll('[data-job]').forEach(b=>b.onclick=async()=>{const job=jobs.get(b.dataset.job);if(!job)return;try{if(b.dataset.op==='pause')await pause(job);if(b.dataset.op==='resume'){job.status='queued';changed();pump();}if(b.dataset.op==='cancel')await cancel(job);if(b.dataset.op==='attach'){await onReady?.(job,{explicit:true});panel.close();}}catch(error){toast(error.message);}});
 }
 function open(){panel=modal('Uploads','<p>Files are saved on this device. Pause, retry, or resume after reopening Vela. Each file can be up to 512 MB.</p><div data-queue-list></div>',{wide:true});draw();}
 return {load,add,open,list};
}
