import {expressionURL} from './util.js';
import './rich-composer.css';

const tokens=()=>/<:([A-Za-z0-9_]{2,32}):([A-Za-z0-9-]+)>/g;
const read=node=>node.nodeType===3?node.data:node.dataset?.emojiToken|| (node.nodeName==='BR'?'\n':[...node.childNodes].map(read).join(''));

// Keep the existing message format and composer API; render each emoji atomically.
export function bindRichComposer(editor,{resolve,onLimit=()=>{}}={}){
 const attempted=new Map(),abort=new AbortController(),options={signal:abort.signal};let remembered={start:0,end:0},composing=false,valid='',resolving=false,disposed=false,history=[{value:'',start:0,end:0}],index=0,restoring=false;
 const value=()=>editor.childNodes.length===1&&editor.firstChild.nodeName==='BR'?'':read(editor);
 function position(){const selection=getSelection();if(selection?.rangeCount){const range=selection.getRangeAt(0);if(editor.contains(range.startContainer)&&editor.contains(range.endContainer)){const before=document.createRange();before.selectNodeContents(editor);before.setEnd(range.startContainer,range.startOffset);const after=document.createRange();after.selectNodeContents(editor);after.setEnd(range.endContainer,range.endOffset);remembered={start:read(before.cloneContents()).length,end:read(after.cloneContents()).length};}}return remembered;}
 function point(offset,end=false){let remaining=Math.max(0,offset);for(const node of editor.childNodes){const length=read(node).length;if(remaining<=length){if(node.nodeType===3)return [node,remaining];const at=[...editor.childNodes].indexOf(node);return [editor,at+(remaining===length||(remaining>0&&end)?1:0)];}remaining-=length;}return [editor,editor.childNodes.length];}
 function select(start,end=start){editor.focus({preventScroll:true});const a=point(start),b=point(end,true),range=document.createRange();range.setStart(...a);range.setEnd(...b);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);remembered={start,end};}
 function emoji(token,name,id){const url=expressionURL(id),node=document.createElement(url?'img':'span');node.dataset.emojiToken=token;node.dataset.emojiId=id;node.contentEditable='false';node.className='composer-emoji';node.title=':'+name+':';if(url){node.src=url;node.alt=':'+name+':';node.draggable=false;}else{node.textContent=':'+name+':';node.classList.add('emoji-loading');}return node;}
 function fragment(text){const result=document.createDocumentFragment();let end=0;for(const match of text.matchAll(tokens())){result.append(document.createTextNode(text.slice(end,match.index)),emoji(match[0],match[1],match[2]));end=match.index+match[0].length;}result.append(document.createTextNode(text.slice(end)));return result;}
 function empty(){editor.dataset.empty=String(value().length===0);}
 function render(text){editor.replaceChildren(fragment(text));empty();hydrate();}
 function refreshImages(){const current=position(),focused=document.activeElement===editor;for(const node of editor.querySelectorAll('[data-emoji-id]')){const url=expressionURL(node.dataset.emojiId);if(!url)continue;if(node.tagName==='IMG'){if(node.src!==url)node.src=url;}else{const match=[...node.dataset.emojiToken.matchAll(tokens())][0];node.replaceWith(emoji(match[0],match[1],match[2]));}}if(focused)select(current.start,current.end);}
 async function hydrate(){if(!resolve||resolving||disposed)return;const ids=[...new Set([...value().matchAll(tokens())].map(m=>m[2]).filter(id=>!expressionURL(id)&&Date.now()-(attempted.get(id)||0)>30000))];if(!ids.length)return;for(const id of ids)attempted.set(id,Date.now());resolving=true;try{await resolve(ids);if(!disposed)refreshImages();}catch{}finally{resolving=false;}}
 function replace(text,start=position().start,end=position().end){const before=value();if(before.length-(end-start)+text.length>4000){onLimit();return false;}const range=document.createRange();range.setStart(...point(start));range.setEnd(...point(end,true));range.deleteContents();range.insertNode(fragment(text));editor.normalize();select(start+text.length);empty();hydrate();return true;}
 Object.defineProperties(editor,{
  value:{get:value,set:text=>{const next=String(text??'');render(next);valid=next;remembered={start:next.length,end:next.length};history=[{value:next,...remembered}];index=0;}},
  selectionStart:{get:()=>position().start,set:start=>select(start,position().end)},selectionEnd:{get:()=>position().end,set:end=>select(position().start,end)},
  setRangeText:{value:(text,start,end)=>replace(String(text),start,end)},setSelectionRange:{value:select}
 });
 editor.addEventListener('input',event=>{if(composing)return;const next=value();if(next.length>4000){render(valid);select(valid.length);onLimit();event.stopImmediatePropagation();return;}valid=next;empty();if(!restoring&&history[index]?.value!==next){history=history.slice(0,index+1);history.push({value:next,...position()});if(history.length>100)history.shift();index=history.length-1;}hydrate();},options);
 editor.addEventListener('compositionstart',()=>composing=true,options);editor.addEventListener('compositionend',()=>{composing=false;editor.dispatchEvent(new Event('input',{bubbles:true}));},options);
 editor.addEventListener('beforeinput',event=>{if(!composing&&['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();if(replace('\n'))editor.dispatchEvent(new Event('input',{bubbles:true}));}},options);
 editor.addEventListener('paste',event=>{if([...event.clipboardData?.items||[]].some(x=>x.kind==='file'&&x.type.startsWith('image/'))||[...event.clipboardData?.files||[]].some(x=>x.type.startsWith('image/')))return;event.preventDefault();if(replace(event.clipboardData?.getData('text/plain')||''))editor.dispatchEvent(new Event('input',{bubbles:true}));},options);
 editor.addEventListener('drop',event=>{if(event.dataTransfer?.files.length)return;event.preventDefault();event.stopPropagation();editor.closest('#main-content')?.classList.remove('dragging');if(replace(event.dataTransfer?.getData('text/plain')||''))editor.dispatchEvent(new Event('input',{bubbles:true}));},options);
 editor.addEventListener('keydown',event=>{
  if(composing||event.isComposing)return;
  if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();const forward=event.key.toLowerCase()==='y'||event.shiftKey,next=Math.max(0,Math.min(history.length-1,index+(forward?1:-1)));if(next!==index){index=next;const state=history[index];restoring=true;render(state.value);select(state.start,state.end);editor.dispatchEvent(new Event('input',{bubbles:true}));restoring=false;}return;}
  if(!['Backspace','Delete'].includes(event.key))return;const current=position();if(current.start!==current.end)return;for(const match of value().matchAll(tokens()))if(event.key==='Backspace'&&current.start===match.index+match[0].length||event.key==='Delete'&&current.start===match.index){event.preventDefault();replace('',match.index,match.index+match[0].length);editor.dispatchEvent(new Event('input',{bubbles:true}));break;}
 },options);
 document.addEventListener('selectionchange',position,options);window.addEventListener('vela-expression-links',refreshImages,options);empty();
 return ()=>{disposed=true;abort.abort();};
}
