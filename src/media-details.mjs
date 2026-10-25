export function cleanMediaTitle(value){return String(value||'').replace(/\.(mp4|mkv|webm|mov|mp3|m4a|wav|ogg|flac)$/i,'').replace(/\.connections(?:\.[a-f0-9]+)?$/i,'').replace(/[\[(]\s*(official\s*)?(music\s*video|video|audio|lyrics?\s*video|visualizer|hd|4k)\s*[\])]/ig,'').replace(/\s+official\s+(music\s+)?video\s*$/i,'').replace(/\s+/g,' ').trim();}
function stamp(seconds){const ms=Math.round(Math.max(0,seconds)*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
export function captionsToVtt(text,name){
 text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 if(/\.lrc$/i.test(name)){
  const cues=[];let offset=Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000;
  for(const line of text.split('\n')){const words=line.replace(/\[[^\]]*\]/g,'').trim();if(!words)continue;for(const match of line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)){const t=Number(match[1])*60+Number(match[2])+Number('0.'+(match[3]||'0'))+offset;cues.push({t,words});}}
  cues.sort((a,b)=>a.t-b.t);if(!cues.length)throw Error('No timed lyrics found in this LRC file.');
  return 'WEBVTT\n\n'+cues.map((cue,i)=>`${stamp(cue.t)} --> ${stamp(Math.max(cue.t+.2,cues[i+1]?.t??cue.t+5))}\n${cue.words}`).join('\n\n')+'\n';
 }
 if(/\.(srt|src)$/i.test(name))text='WEBVTT\n\n'+text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2');
 if(!text.trimStart().startsWith('WEBVTT')||!text.includes('-->'))throw Error('Choose a VTT, SRT or timed LRC subtitle file.');
 return text;
}
