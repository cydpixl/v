export function normalizeTitle(value) {
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
}
export function titleQuery(value) {
  const text=String(value||'').trim(), match=text.match(/\s*[([]?((?:19|20)\d{2})[)\]]?\s*$/);
  return {title:match?text.slice(0,match.index).trim():text,year:match?.[1]||''};
}
export function chooseTitleMatch(items,query,kind,year='') {
  const parsed=titleQuery(query),wanted=normalizeTitle(parsed.title),expectedYear=year||parsed.year;
  const candidates=(items||[]).filter(item=>(!item.type||item.type===kind)&&(!expectedYear||String(item.year)===expectedYear)&&[item.title,item.originalTitle].some(title=>normalizeTitle(title)===wanted));
  if(!candidates.length)return null;
  return candidates.sort((a,b)=>(Number(b.year===expectedYear)-Number(a.year===expectedYear))*100+(Number(b.popularity)||0)-(Number(a.popularity)||0))[0];
}
