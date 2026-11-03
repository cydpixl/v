// Keep long conversations available in memory without mounting every message.
const views=new WeakMap();
const LIMIT=100,BUFFER=20;
const estimate=message=>message.attachment?240:Math.max(54,Math.min(180,48+Math.ceil(String(message.text||'').length/95)*20));
function prefix(items,heights){const result=[0];for(const item of items)result.push(result.at(-1)+(heights.get(item.id)||estimate(item)));return result;}
function indexAt(values,position){let low=0,high=values.length-1;while(low<high){const mid=(low+high+1)>>1;if(values[mid]<=position)low=mid;else high=mid-1;}return low;}
export function messageWindow(items,{target,scroll,bottom,focusId,onChange}){
 let state=views.get(target);
 if(!state){state={heights:new Map(),start:0,end:0,items:[],values:[0],frame:0};views.set(target,state);
  target.addEventListener('load',()=>{if(target.isConnected&&!document.body.classList.contains('chat-app-hidden'))measureMessageWindow(target,scroll);},true);
  scroll.addEventListener('scroll',()=>{if(state.frame)return;state.frame=requestAnimationFrame(()=>{state.frame=0;if(!target.isConnected||document.body.classList.contains('chat-app-hidden'))return;const origin=target.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop,position=Math.max(0,scroll.scrollTop-origin),at=indexAt(state.values,position),last=indexAt(state.values,position+scroll.clientHeight);if(at<state.start+8&&state.start>0||last>state.end-8&&state.end<state.items.length)state.onChange();});},{passive:true});
 }
 state.onChange=onChange;state.items=items;state.values=prefix(items,state.heights);
 const origin=target.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop;
 let at=indexAt(state.values,Math.max(0,scroll.scrollTop-origin));
 if(bottom)at=items.length-1;
 const focusChanged=!!focusId&&focusId!==state.focusId;
 if(focusChanged){const index=items.findIndex(item=>item.id===focusId);if(index>=0)at=index;}
 state.focusId=focusId;
 // Anchor the same message when a page is prepended or its measured height changes.
 if(!bottom&&!focusChanged){const bounds=scroll.getBoundingClientRect(),top=bounds.top,anchor=[...target.querySelectorAll(':scope > [data-message]')].find(row=>{const rect=row.getBoundingClientRect();return rect.bottom>top&&rect.top<bounds.bottom})?.dataset.message;if(anchor){const index=items.findIndex(item=>item.id===anchor);if(index>=0)at=index;}}
 state.start=Math.max(0,Math.min(Math.max(0,items.length-LIMIT),at-BUFFER));state.end=Math.min(items.length,state.start+LIMIT);
 return {items:items.slice(state.start,state.end),before:state.values[state.start],after:state.values.at(-1)-state.values[state.end]};
}
export function measureMessageWindow(target,scroll){
 const state=views.get(target);if(!state)return;
 const top=scroll.getBoundingClientRect().top,rows=[...target.querySelectorAll(':scope > [data-message]')];
 state.anchor=rows.find(row=>row.getBoundingClientRect().bottom>top)?.dataset.message;
 for(const row of rows){const rect=row.getBoundingClientRect(),previous=row.previousElementSibling,divider=previous?.classList.contains('date-divider')?previous.getBoundingClientRect().height:0;state.heights.set(row.dataset.message,rect.height+divider);}
 state.values=prefix(state.items,state.heights);
 const before=target.querySelector('[data-message-spacer="before"]'),after=target.querySelector('[data-message-spacer="after"]');
 if(before)before.style.height=state.values[state.start]+'px';if(after)after.style.height=(state.values.at(-1)-state.values[state.end])+'px';
}
