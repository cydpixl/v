import {escape as e} from './util.js';
import './expression-upload.css';

export function uploadExpressions({kind,conversation,existing=[],api,modal,toast,onDone}){
 const noun=kind==='emoji'?'emojis':kind==='gif'?'GIFs':'stickers',limit=kind==='emoji'?512*1024:10*1024*1024,accept=kind==='gif'?'image/gif,image/webp':'image/png,image/gif,image/webp,image/jpeg';
 let queue=[],running=false,stopped=false,disposed=false;
 const urls=[];
 const dialog=modal('Upload '+noun,`<form class="expression-bulk-form"><label>ADD TO<select name="pack"><option value="">Personal collection</option>${conversation?`<option value="${e(conversation.id)}">${e(conversation.name)}</option>`:''}</select></label><label class="expression-dropzone">Choose files or drop them here<input name="files" type="file" accept="${accept}" multiple></label><p class="muted">Select up to 100 files. Names come from filenames and can be edited. ${kind==='emoji'?'PNG, GIF, WebP or JPEG · 512 KB each.':kind==='gif'?'GIF or animated WebP · 10 MB each.':'PNG, GIF, WebP or JPEG · 10 MB each.'} Animation and transparency are preserved.</p><div class="expression-upload-list"></div><p class="expression-upload-progress" role="status"></p><p class="form-error" role="alert"></p><footer><button type="button" class="secondary" data-stop hidden>Stop remaining</button><button type="button" class="secondary" data-done hidden>Done</button><button type="submit" class="primary" disabled>Upload</button></footer></form>`,{onclose:()=>{stopped=true;disposed=true;urls.forEach(URL.revokeObjectURL);}});
 const form=dialog.querySelector('form'),files=form.elements.files,pack=form.elements.pack,list=form.querySelector('.expression-upload-list'),progress=form.querySelector('.expression-upload-progress'),error=form.querySelector('.form-error'),submit=form.querySelector('[type=submit]'),stop=form.querySelector('[data-stop]'),done=form.querySelector('[data-done]');
 const summary=()=>{const uploaded=queue.filter(x=>x.state==='uploaded').length,failed=queue.filter(x=>x.state==='failed'||x.state==='invalid').length;progress.textContent=queue.length?`${uploaded} of ${queue.length} uploaded${failed?' · '+failed+' need attention':''}${stopped?' · Stopped':''}`:'';done.hidden=running||!uploaded;submit.disabled=running||!queue.some(x=>['ready','failed'].includes(x.state));submit.textContent=queue.some(x=>x.state==='failed')?'Retry failed':'Upload '+queue.filter(x=>x.state==='ready').length+' files';stop.hidden=!running;};
 function state(item,text){if(disposed)return;const row=list.children[queue.indexOf(item)];row.dataset.state=item.state;row.querySelector('[data-status]').textContent=text;summary();}
 function choose(selected){
  if(running)return;submit.hidden=false;error.textContent='';if(selected.length>100){error.textContent='Select up to 100 files per batch.';return;}
  urls.splice(0).forEach(URL.revokeObjectURL);list.replaceChildren();stopped=false;queue=[];pack.disabled=false;
  const used=new Set(existing.map(x=>x.name.toLowerCase()));
  for(const [index,file]of selected.entries()){
   const base=file.name.replace(/\.[^.]+$/,'').normalize('NFKD').replace(/[^A-Za-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,32)||kind+'_'+(index+1);let name=base.length<2?base+'_':base,n=2;while(used.has(name.toLowerCase())){const suffix='_'+n++;name=base.slice(0,32-suffix.length)+suffix;}used.add(name.toLowerCase());
   const type=file.type||(/\.gif$/i.test(file.name)?'image/gif':/\.webp$/i.test(file.name)?'image/webp':/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':'');const valid=(kind==='gif'?['image/gif','image/webp']:['image/gif','image/webp','image/png','image/jpeg']).includes(type)&&file.size>0&&file.size<=limit;
   const item={file,type,name,state:valid?'ready':'invalid'};queue.push(item);const row=document.createElement('div');row.className='expression-upload-row';row.innerHTML='<img alt=""><div><small></small><input aria-label="Expression name" pattern="[A-Za-z0-9_]{2,32}" maxlength="32" required><span data-status></span></div>';row.dataset.state=item.state;row.querySelector('small').textContent=file.name;row.querySelector('input').value=name;row.querySelector('input').oninput=event=>item.name=event.target.value;list.append(row);
   if(valid){const url=URL.createObjectURL(file);urls.push(url);row.querySelector('img').src=url;}else row.querySelector('img').hidden=true;
   row.querySelector('[data-status]').textContent=valid?'Ready':file.size>limit?'File exceeds '+(kind==='emoji'?'512 KB':'10 MB'):'Unsupported or empty image';
  }summary();
 }
 files.onchange=()=>choose([...files.files]);form.ondragover=event=>{event.preventDefault();form.classList.add('dragging');};form.ondragleave=()=>form.classList.remove('dragging');form.ondrop=event=>{event.preventDefault();form.classList.remove('dragging');choose([...event.dataTransfer.files]);};
 stop.onclick=()=>{stopped=true;stop.disabled=true;stop.textContent='Finishing current uploads…';};done.onclick=()=>{dialog.close();onDone?.();};
 form.onsubmit=async event=>{
  event.preventDefault();if(running)return;const pending=queue.filter(x=>['ready','failed'].includes(x.state));if(!pending.length)return;
  const names=new Set();for(const item of queue){if(!/^[A-Za-z0-9_]{2,32}$/.test(item.name)||names.has(item.name.toLowerCase())){error.textContent='Use distinct names with 2–32 letters, numbers or underscores.';return;}names.add(item.name.toLowerCase());}
  running=true;stopped=false;error.textContent='';files.disabled=true;pack.disabled=true;list.querySelectorAll('input').forEach(input=>input.disabled=true);stop.disabled=false;stop.textContent='Stop remaining';summary();let cursor=0;const target=pack.value;
  async function worker(){while(!stopped&&cursor<pending.length){const item=pending[cursor++];item.state='uploading';state(item,'Uploading…');try{
    for(let attempt=0;;attempt++){try{await api('/expression-upload?'+new URLSearchParams({kind,name:item.name,pack:target}),{method:'POST',headers:{'Content-Type':item.type},body:item.file});break;}catch(reason){if(reason.status!==429||attempt>=4||stopped)throw reason;state(item,'Rate limit reached · retrying shortly…');await new Promise(resolve=>setTimeout(resolve,15000));if(disposed||stopped)throw Error('Stopped before retry.');}}
    item.state='uploaded';state(item,'Uploaded');
   }catch(reason){item.state='failed';state(item,reason.message);if([401,403,507].includes(reason.status)){stopped=true;if(!disposed)error.textContent=reason.message;}}}}
  await Promise.all([worker(),worker()]);running=false;if(disposed)return;files.disabled=false;pack.disabled=queue.some(x=>x.state==='uploaded');list.querySelectorAll('input').forEach((input,index)=>input.disabled=['uploaded','invalid'].includes(queue[index].state));summary();
  if(queue.every(x=>x.state==='uploaded')){submit.hidden=true;toast(queue.length+' '+noun+' uploaded.');}else submit.hidden=false;
 };
 return dialog;
}
