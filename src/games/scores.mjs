import {gameDefinition} from './catalog.mjs';
const key=owner=>'vela.games.scores.v1.'+owner;
export function readScores(owner,id){try{const records=JSON.parse(localStorage.getItem(key(owner))||'[]');return Array.isArray(records)?records.filter(r=>r.game===id&&Number.isFinite(r.value)&&Number.isFinite(r.at)):[];}catch{return [];}}
export function saveScore(owner,id,result){
  let all=[];try{const saved=JSON.parse(localStorage.getItem(key(owner))||'[]');if(Array.isArray(saved))all=saved;}catch{}
  const record={game:id,at:Date.now(),value:result.value,display:result.display,won:!!result.won,accuracy:result.accuracy};
  try{localStorage.setItem(key(owner),JSON.stringify([...all,record].slice(-4000)));return true;}catch{return false;}
}
export function rankedScores(owner,id,period='all'){
  const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(period==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
  const records=readScores(owner,id).filter(r=>period==='all'||r.at>=start.getTime());
  const lower=gameDefinition(id)?.lower;return records.sort((a,b)=>(lower?a.value-b.value:b.value-a.value)||b.at-a.at);
}
export function formatBest(id,value){return id==='stop-ten'?value.toFixed(3)+' s off':Math.round(value)+' '+gameDefinition(id).unit;}
