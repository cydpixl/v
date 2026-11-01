import {parseSongMessage} from './song-model.mjs';
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function normalizeRewriteConfig(value){
 if(!value||!Array.isArray(value.rules)||value.rules.length>100)throw Error('Choose up to 100 replacement rules.');
 const ids=new Set();
 return {enabled:value.enabled===true,rules:value.rules.map(rule=>{
  const id=String(rule.id||'');if(!/^[a-zA-Z0-9-]{1,80}$/.test(id)||ids.has(id))throw Error('Each rule needs a unique identifier.');ids.add(id);
  const trigger=String(rule.trigger??'').trim(),replacement=String(rule.replacement??'');
  if(!trigger||trigger.length>200||!replacement.trim()||replacement.length>4000)throw Error('Enter a trigger (up to 200 characters) and replacement (up to 4,000).');
  const match=['contains','exact','flexible'].includes(rule.match)?rule.match:'contains';
  if(match==='flexible'&&!/[\p{L}\p{N}]/u.test(trigger))throw Error('Flexible triggers need at least one letter or number.');
  return {id,trigger,replacement,match,action:rule.action==='phrase'?'phrase':'message',target:['everyone','members','admins'].includes(rule.target)?rule.target:'everyone',enabled:rule.enabled!==false};
 })};
}
function matcher(rule){
 if(rule.match==='flexible'){
  const letters=[...rule.trigger.normalize('NFKC').toLowerCase()].filter(c=>/[\p{L}\p{N}]/u.test(c)).join('');
  const chars=[...letters.replace(/(.)\1+/gu,'$1')];
  return new RegExp('(?<![\\p{L}\\p{N}])'+chars.map(c=>escape(c)+'+').join('[\\s\\p{P}\\p{S}\u200B-\u200D]*')+'(?![\\p{L}\\p{N}])','giu');
 }
 return new RegExp((rule.match==='exact'?'^\\s*':'')+escape(rule.trigger)+(rule.match==='exact'?'\\s*$':''),'giu');
}
function replaceBounded(input,regex,replacement){
 let output='',offset=0;regex.lastIndex=0;
 for(const match of input.matchAll(regex)){
  output+=input.slice(offset,match.index)+replacement;
  if(output.length>=4000)return output.slice(0,4000);
  offset=match.index+match[0].length;
 }
 return (output+input.slice(offset)).slice(0,4000);
}
export function applyRewriteRules(text,config,{admin=false}={}){
 const original=String(text??'');if(parseSongMessage(original)||!config?.enabled)return original;
 if(/^\[\[vela-live-music:1:[A-Za-z0-9_-]+\]\]$/.test(original))return original;
 let result=original;
 for(const rule of config.rules||[]){
  if(!rule.enabled||rule.target==='admins'&&!admin||rule.target==='members'&&admin)continue;
  const regex=matcher(rule);if(!regex.test(result))continue;
  if(rule.action==='message')return rule.replacement;
  result=replaceBounded(result,regex,rule.replacement);
 }
 return result;
}
