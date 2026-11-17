import './chat-backgrounds.css';
const PRESETS=[['Default',''],['Dusk','linear-gradient(135deg,#182435,#324257)'],['Forest','linear-gradient(135deg,#162b24,#42614b)'],['Clay','linear-gradient(135deg,#352523,#875b4f)'],['Midnight','linear-gradient(135deg,#0a1222,#2b3054)'],['Lavender','linear-gradient(135deg,#2e2547,#675989)']];
const key=(owner,cid)=>'vela.chat.background.'+owner+'.'+cid;
export function applyChatBackground(owner,cid){
 const el=document.getElementById('message-scroll');if(!el||!owner||!cid)return;
 let saved='';try{saved=localStorage.getItem(key(owner,cid))||''}catch{}
 const photo=/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(saved)&&saved.length<2300000;
 const preset=PRESETS.find(item=>item[0]===saved);
 el.style.backgroundImage=photo?'linear-gradient(#11192726,#11192726),url("'+saved+'")':preset?.[1]||'';
 el.style.backgroundSize=photo?'cover':'';
 el.style.backgroundPosition=photo?'center':'';
 el.style.backgroundColor=photo?'#111927':'';
}
export function chooseChatBackground({owner,cid,modal,toast}){
 const content='<div class="chat-background-options">'+PRESETS.map(([name,background])=>'<button type="button" data-chat-background="'+name+'" class="chat-background-swatch" style="--swatch:'+(background||'linear-gradient(135deg,#243247,#151e2e)')+'"><span></span><strong>'+name+'</strong></button>').join('')+'</div><label class="chat-background-upload">Upload your own image<input type="file" accept="image/png,image/jpeg,image/webp" data-chat-photo></label><p class="chat-background-note">Saved only on this device for this conversation.</p>';
 const dialog=modal('Chat background',content);
 dialog.querySelectorAll('[data-chat-background]').forEach(button=>{button.onclick=()=>{try{localStorage.setItem(key(owner,cid),button.dataset.chatBackground);applyChatBackground(owner,cid);dialog.close()}catch{toast('Unable to save this background.')}}});
 dialog.querySelector('[data-chat-photo]').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;if(file.size>15*1024*1024)return toast('Choose an image under 15 MB.');
  let bitmap;try{
   bitmap=await createImageBitmap(file);
   const scale=Math.min(1,1280/bitmap.width,800/bitmap.height),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   localStorage.setItem(key(owner,cid),canvas.toDataURL('image/webp',.72));
   applyChatBackground(owner,cid);dialog.close();
  }catch{toast('Could not save that image. Try a smaller photo.')}finally{bitmap?.close()}
 };
}
