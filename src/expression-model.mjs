export const searchWords=value=>String(value||'').toLocaleLowerCase().replace(/[:_]+/g,' ').trim().split(/\s+/).filter(Boolean);
export function matchesExpression(item,query){const haystack=[item.name,item.id,item.pack_name,...(item.keywords||[])].join(' ').toLocaleLowerCase().replace(/_/g,' ');return searchWords(query).every(word=>haystack.includes(word));}
export function uniqueMedia(items){const seen=new Set();return items.filter(item=>item?.id&&!seen.has(item.id)&&seen.add(item.id));}
export function nextGifPage(data,offset,maximum=1000){const count=Math.max(0,Number(data.pagination?.count) || data.data?.length || 0),nextOffset=offset+count;return {nextOffset,more:count>0&&nextOffset<Number(data.pagination?.total_count||0)&&nextOffset<maximum};}
export function requestGate(){let revision=0;return {invalidate:()=>++revision,current:token=>token===revision};}
