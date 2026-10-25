const validURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&/^(media\d*|i)\.giphy\.com$/.test(u.hostname)}catch{return false}};
export function normalizeGif(item){
 const images=item?.images||{},image=[images.fixed_height,images.fixed_width,images.original].find(x=>validURL(x?.url));
 if(!image||typeof item.id!=='string'||!/^[a-zA-Z0-9]{1,80}$/.test(item.id))return null;
 const preview=[images.fixed_width?.webp,images.fixed_height?.webp,image.url].find(validURL);
 return {id:item.id,name:item.title||'GIF',url:image.url,preview,width:Number(image.width)||0,height:Number(image.height)||0};
}
export function gifPagination(data,offset,maximum){const count=Array.isArray(data.data)?data.data.length:0,nextOffset=offset+count;return {nextOffset,more:count>0&&nextOffset<Number(data.pagination?.total_count||0)&&nextOffset<=maximum};}
export async function fetchGiphy(url){try{const response=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Provider response failed');const data=await response.json();if(!data||typeof data!=='object')throw Error('Invalid provider response');return data;}catch{throw Object.assign(Error('GIF search is temporarily unavailable. Try again.'),{status:502});}}
