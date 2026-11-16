import {assetURL} from './config.js';
import './date-app.css';

const TITLE='date. · Our first date';
const SOURCE='vela-date';
const MAX_FILE=95*1024*1024; // The deployed Vela /api/uploads limit.
const allowed=/^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm|quicktime|x-m4v)|audio\/(mpeg|mp4|ogg|webm|wav)|application\/(pdf|zip|octet-stream)|text\/plain)$/;
const blank=()=>({version:3,name:'',story:'',when:'',place:'',address:'',media:[],places:[]});
const clean=m=>({version:3,name:String(m?.name||'').slice(0,36),story:typeof m?.story==='string'?m.story:'',when:typeof m?.when==='string'?m.when:'',place:String(m?.place||'').slice(0,240),address:String(m?.address||'').slice(0,320),media:Array.isArray(m?.media)?m.media.filter(x=>x?.id&&['file','gif','link'].includes(x.kind)).slice(0,500):[],places:Array.isArray(m?.places)?m.places.filter(x=>x?.id&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lon)).slice(0,300):[]});
export function mountDateApp(root,{api,owner,toast}){
 let alive=true,frame,uid=owner,record=null,saving=false,pending=null,timer,requested=0,initializing=true,retryCount=0,blocked=false;
 const post=(type,payload={})=>{if(alive&&frame?.contentWindow)frame.contentWindow.postMessage({source:SOURCE,type,...payload},location.origin)};
 const fail=e=>{post('status',{status:'Not synced',message:e.message||String(e)});};
 root.innerHTML='<section class="vela-date-app"><iframe class="vela-date-frame" title="date. — Our first date" allow="camera; microphone; clipboard-read; clipboard-write" loading="eager"></iframe></section>';
 frame=root.querySelector('iframe');
 frame.src=assetURL('date/index.html');
 const attachments=()=>record?.text?clean(JSON.parse(record.text)).media.filter(m=>m.kind==='file'&&m.remote):[];
 async function fileLinks(items){
  const ids=[...new Set(items.filter(x=>x.kind==='file'&&x.remote).map(x=>x.remote))],links={};
  for(let i=0;i<ids.length;i+=50){
   try{Object.assign(links,(await api('/file-links',{method:'POST',body:{ids:ids.slice(i,i+50)}})).links||{})}catch(error){console.warn('Date: media links unavailable',error)}
  }
  return links;
 }
 async function load(){
  const list=await api('/shared-notes');
  const found=(list.items||[]).find(n=>n.title===TITLE&&n.owner===uid)||(list.items||[]).find(n=>n.title===TITLE);
  let id=found?.id;
  if(!id){
   const note=await api('/shared-notes',{method:'POST',body:{title:TITLE,text:JSON.stringify(blank()),members:[]}});
   id=note.id;
  }
  const note=await api('/shared-notes/'+id);if(!alive)return;
  record=note;
  let data=blank();try{data=clean(JSON.parse(note.text))}catch{data={...data,story:note.text}}
  const account=await api('/me').catch(()=>({user:null}));
  post('load',{owner:uid,accountName:account.user?.name||account.user?.handle||'You',snapshot:data,links:await fileLinks(data.media),noteId:id,revision:note.revision});
  initializing=false;
 }
 async function save(){
  if(!alive||!record||!pending||saving||blocked)return;
  saving=true;
  const snapshot=clean(pending);pending=null;
  const payload={title:TITLE,text:JSON.stringify(snapshot),revision:record.revision};
  post('status',{status:'Saving…'});
  try{
   const result=await api('/shared-notes/'+record.id,{method:'PUT',body:payload});
   if(!alive)return;
   record.revision=result.revision;
   record.text=payload.text;retryCount=0;
   post('status',{status:'Synced'});
  }catch(e){
   if(!alive)return;
   pending=pending||snapshot;
   if(e.status===409){
    blocked=true;
    // Never automatically overwrite a collaborator's version.
    post('status',{status:'Conflict',message:'The story changed elsewhere. Your local draft is untouched. Reopen the app to review.'});
    return;
   }
   retryCount++;
   fail(e);
  }finally{
   saving=false;
   if(pending&&alive&&!blocked&&retryCount<4)clearTimeout(timer),timer=setTimeout(save,Math.min(30000,1500*2**retryCount));
  }
 }
 async function upload(file,requestId){
  if(!(file instanceof Blob)){post('upload-result',{requestId,error:'No file was received.'});return}
  const mime=(file.type||'application/octet-stream').split(';')[0];
  if(file.size>MAX_FILE){post('upload-result',{requestId,error:'Vela allows files up to 95 MB here.'});return}
  if(!allowed.test(mime)){post('upload-result',{requestId,error:'This file format is not accepted by Vela storage. Use JPG, PNG, MP4, WebM, MP3 or PDF.'});return}
  try{
   const upload=await api('/uploads',{method:'POST',body:file,headers:{'Content-Type':mime,'X-File-Name':encodeURIComponent(file.name||'Attachment')},onUploadProgress:bytes=>post('upload-progress',{requestId,bytes,total:file.size})});
   if(!alive)return;
   const id=upload.upload?.id;if(!id)throw Error('Upload completed without a file ID');
   const links=(await api('/file-links',{method:'POST',body:{ids:[id]}})).links||{};
   post('upload-result',{requestId,remote:id,url:links[id]||null});
  }catch(e){if(alive)post('upload-result',{requestId,error:e.message||'Upload failed. Try again.'})}
 }
 async function gifs(term,requestId){
  try{const data=await api('/gifs?'+new URLSearchParams({q:String(term||'').slice(0,100),offset:'0'}));post('gif-results',{requestId,items:data.items||[]})}
  catch(e){post('gif-results',{requestId,error:e.message||'GIFs unavailable',items:[]})}
 }
 async function share(requestId){
  try{
   const me=await api('/state');
   const eligible=(me.friends||[]).filter(f=>f.uid!==uid&&!f.blocked&&!f.blockedBy&&f.status==='accepted').map(f=>({uid:f.uid,name:f.name||f.handle||f.uid}));
   const current=record?.members||[];
   post('share-data',{requestId,items:eligible,selected:current.filter(m=>m.uid!==uid).map(m=>m.uid),isOwner:record?.owner===uid});
  }catch(e){post('share-data',{requestId,error:e.message})}
 }
 async function shareSave(requestId,members){
  try{
   if(!record||record.owner!==uid)throw Error('Only the owner can manage sharing.');
   if(!Array.isArray(members)||members.length>9)throw Error('Choose up to nine friends.');
   await api('/shared-notes/'+record.id+'/members',{method:'PUT',body:{members}});
   record=await api('/shared-notes/'+record.id);
   post('share-done',{requestId,ok:true});
  }catch(e){post('share-done',{requestId,error:e.message})}
 }
 const onMessage=e=>{
  if(!alive||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.source!==SOURCE)return;
  const msg=e.data;
  switch(msg.type){
   case 'ready':load().catch(error=>{post('load',{owner:uid,accountName:'You',snapshot:blank(),links:{},offline:true});fail(error);});break;
   case 'update':
    if(initializing)return;
    pending=msg.snapshot;
    if(!blocked){clearTimeout(timer);timer=setTimeout(save,700);}
    break;
   case 'upload':upload(msg.file,msg.requestId);break;
   case 'gif-search':gifs(msg.term,msg.requestId);break;
   case 'share':share(msg.requestId);break;
   case 'share-save':shareSave(msg.requestId,msg.members);break;
   case 'toast':toast(String(msg.message||''));break;
  }
 };
 window.addEventListener('message',onMessage);
 return ()=>{
  alive=false;clearTimeout(timer);
  window.removeEventListener('message',onMessage);
  // Pending edits are already saved in the iframe's local draft. Closing a window
  // must not launch a detached write that could race a collaborator's changes.
  frame.src='about:blank';root.replaceChildren();
 };
}
