// Refreshes and history pages can overlap; keep one current copy in time order.
export function mergeMessagePage(current,page,{query='',startedAt=0}={}){
 const retained=query?current.filter(message=>message.created>=startedAt):current;
 const messages=new Map(retained.map(message=>[message.id,message]));
 for(const message of page)messages.set(message.id,message);
 return [...messages.values()].sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id));
}
