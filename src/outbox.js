// Drain the live queue, including messages added while a request is in flight.
export function createOutboxPump({state,send,accept,changed,online=()=>navigator.onLine,now=Date.now}){
 let running=null,timer,generation=0;
 // Only the first retryable message in each conversation can unblock its queue.
 function heads(){const seen=new Set();return state().outbox.filter(m=>{if(m.failed||seen.has(m.conversation))return false;seen.add(m.conversation);return true;});}
 async function drain(owner,token){
  clearTimeout(timer);
  const current=()=>generation===token&&state().user?.uid===owner;
  if(!owner||!online())return;
  while(current()&&online()){
   const m=heads().find(m=>!m.retryAt||m.retryAt<=now());if(!m)break;
   m.pending=true;
   try{
    const result=await send(m);
    if(!current())return;
    state().outbox=state().outbox.filter(x=>x.id!==m.id);
    accept(m,result);changed();
   }catch(error){
    if(!current())return;
    // A live acknowledgement may have arrived before the HTTP request failed.
    if(!state().outbox.some(x=>x.id===m.id))continue;
    const transient=!error.status||[408,429].includes(error.status)||error.status>=500;
    m.attempts=(m.attempts||0)+1;m.failed=!transient;m.pending=transient;
    m.retryAt=transient?now()+Math.min(30000,1000*2**Math.min(m.attempts-1,5)):0;
    changed();
   }
  }
  if(current()&&online()){
   const next=heads().filter(x=>x.retryAt).map(x=>x.retryAt);
   if(next.length)timer=setTimeout(()=>{if(current())flush();},Math.max(1,Math.min(...next)-now()));
  }
 }
 function flush(){if(!running){const owner=state().user?.uid,token=generation;const task=drain(owner,token).finally(()=>{if(running!==task)return;running=null;if(token===generation&&owner!==state().user?.uid&&state().user&&online())flush();});running=task;}return running;}
 return {flush,reset(){generation++;clearTimeout(timer);running=null;}};
}
