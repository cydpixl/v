// Drain the live queue, including messages added while a request is in flight.
export function createOutboxPump({state,send,accept,changed,online=()=>navigator.onLine,now=Date.now}){
 let running=null,timer;
 async function drain(){
  clearTimeout(timer);
  const owner=state().user?.uid;if(!owner||!online())return;
  while(state().user?.uid===owner&&online()){
   const conversations=new Set();
   const m=state().outbox.find(m=>{if(m.failed||conversations.has(m.conversation))return false;conversations.add(m.conversation);return !m.retryAt||m.retryAt<=now();});if(!m)break;
   m.pending=true;
   try{
    const result=await send(m);
    if(state().user?.uid!==owner)return;
    state().outbox=state().outbox.filter(x=>x.id!==m.id);
    accept(m,result);changed();
   }catch(error){
    if(state().user?.uid!==owner)return;
    // A live acknowledgement may have arrived before the HTTP request failed.
    if(!state().outbox.some(x=>x.id===m.id))continue;
    const transient=!error.status||[408,429].includes(error.status)||error.status>=500;
    m.attempts=(m.attempts||0)+1;m.failed=!transient;m.pending=transient;
    m.retryAt=transient?now()+Math.min(30000,1000*2**Math.min(m.attempts-1,5)):0;
    changed();
   }
  }
  if(state().user?.uid===owner&&online()){
   const next=state().outbox.filter(x=>!x.failed&&x.retryAt).map(x=>x.retryAt);
   if(next.length)timer=setTimeout(()=>flush(),Math.max(1,Math.min(...next)-now()));
  }
 }
 function flush(){if(!running){const owner=state().user?.uid;running=drain().finally(()=>{running=null;if(owner!==state().user?.uid&&state().user&&online())flush();});}return running;}
 return {flush,reset(){clearTimeout(timer);}};
}
