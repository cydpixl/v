import {liveMusicMarkup,parseLiveMusicMessage,startLiveMusicWidgets} from './live-music.js';

// A separate read keeps saved players available when their history message is
// older than the current page. The message itself is never moved or deleted.
export function createLiveMusicDock({api,user}){
 let host,cid='',records=[],selected='',timer,busy=false,rerun=false,generation=0,lastFetched=0;
 function available(){return records.filter(m=>{const track=parseLiveMusicMessage(m.text);return track&&(m.pinned||Date.now()-track.at<90000);});}
 function draw(){
  if(!host?.isConnected)return;
  const items=available();host.hidden=!items.length;if(!items.length){host.replaceChildren();return;}
  const current=items.find(m=>m.id===selected)||items[0];selected=current.id;
  const track=parseLiveMusicMessage(current.text),status=Date.now()-track.at>=90000?'Saved':track.playing?'Live':'Paused';
  const signature=JSON.stringify([items.map(m=>[m.id,m.text,m.pinned]),status]);
  if(host.dataset.signature===signature&&host.dataset.selected===selected)return;
  host.dataset.signature=signature;host.dataset.selected=selected;
  const header=document.createElement('header'),label=document.createElement('span');
  label.textContent=current.pinned?'Pinned in this chat':'Listening in this chat';header.append(label);
  if(items.length>1){const select=document.createElement('select');select.setAttribute('aria-label','Shared music player');for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=(item.pinned?'Pinned · ':'')+(user(item.sender).name||'Participant')+' · '+parseLiveMusicMessage(item.text).title;option.selected=item.id===selected;select.append(option);}select.onchange=()=>{selected=select.value;delete host.dataset.signature;draw();};header.append(select);}
  const activity=document.createElement('small');activity.className='music-dock-status';activity.textContent=status;activity.classList.toggle('is-live',status==='Live');header.append(activity);
  const content=document.createElement('div');content.innerHTML=liveMusicMarkup(current.text,current.sender,{id:current.id,pinned:current.pinned,compact:true});
  host.replaceChildren(header,content);startLiveMusicWidgets(host,api,cid);
 }
 async function refresh(force=false){
  if(!host?.isConnected||!cid)return;if(busy){if(force)rerun=true;return;}
  if(!force&&Date.now()-lastFetched<30000)return;
  busy=true;const epoch=generation,conversation=cid;
  try{const data=await api('/conversations/'+encodeURIComponent(conversation)+'/live-music');if(epoch!==generation)return;lastFetched=Date.now();records=data.messages||[];draw();}
  catch{/* Keep the last confirmed player through transient connection errors. */}
  finally{if(epoch===generation){busy=false;if(rerun){rerun=false;void refresh(true);}}}
 }
 function mount(node,conversation){
  if(cid!==conversation){generation++;records=[];selected='';cid=conversation;busy=false;lastFetched=0;}
  host=node;draw();clearInterval(timer);timer=setInterval(()=>{draw();if(records.some(m=>Date.now()-(parseLiveMusicMessage(m.text)?.at||0)<90000)&&!document.hidden)refresh();},30000);void refresh();
 }
 function reset(){generation++;clearInterval(timer);timer=null;host=null;cid='';records=[];selected='';busy=false;rerun=false;lastFetched=0;}
 return {mount,refresh,reset,has:id=>records.some(m=>m.id===id)};
}
