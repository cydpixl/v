const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function inline(text) {
 const tokens=[],stash=html=>`\u0000${tokens.push(html)-1}\u0000`;
 text=text.replace(/`([^`\n]+)`/g,(_,code)=>stash(`<code>${escape(code)}</code>`));
 text=text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>stash(`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`));
 text=text.replace(/https?:\/\/[^\s<>"'\u0000]+/g,url=>stash(`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(url)}</a>`));
 text=text.replace(/<:[A-Za-z0-9_]{2,32}:[A-Za-z0-9-]+>|\[\[vela-emoji:\d{1,3}:[^\]\s]{1,800}\]\]/g,value=>stash(escape(value)));
 text=escape(text).replace(/\|\|([^|]+)\|\|/g,'<button type="button" class="text-spoiler" aria-label="Reveal spoiler" aria-expanded="false"><span>$1</span></button>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<u>$1</u>').replace(/~~([^~]+)~~/g,'<s>$1</s>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/_([^_]+)_/g,'<em>$1</em>');
 return text.replace(/\u0000(\d+)\u0000/g,(_,index)=>tokens[Number(index)]);
}
export function renderMessageMarkdown(value) {
 const text=String(value||''),blocks=text.split(/(```[\s\S]*?(?:```|$))/g);
 return blocks.map(block=>{if(block.startsWith('```')){const code=block.slice(3).replace(/```$/,''),newline=code.indexOf('\n');return `<pre><code>${escape(newline>=0?code.slice(newline+1):code)}</code></pre>`;}return block.split('\n').map(line=>{
  const heading=line.match(/^(#{1,3}) (.*)$/);if(heading)return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
  if(line.startsWith('-# '))return `<small class="message-subtext">${inline(line.slice(3))}</small>`;
  if(line.startsWith('> '))return `<blockquote>${inline(line.slice(2))}</blockquote>`;
  const item=line.match(/^(?:[-*]|\d+\.) (.*)$/);if(item)return `<div class="message-list-item">• ${inline(item[1])}</div>`;
  return inline(line);
 }).join('<br>');}).join('');
}
