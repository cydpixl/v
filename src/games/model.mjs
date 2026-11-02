const WORDS = 'river silver quiet orbit glass bloom cloud ocean bright gentle forest velvet stone amber light dream pulse rhythm wave drift fresh green swift echo moon space flame pearl frost north rain music paper summer night spark lemon lucky smile blue coral tiny round magic flow crisp coast brave maple dance clean soft wild golden dawn still arrow sky field winter warm road star home vivid pine'.split(' ');
export const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const winner = board => lines.find(line => board[line[0]] && line.every(i => board[i] === board[line[0]]));
export function bestMove(board) {
  function search(cells, turn, depth) {
    const line=winner(cells);
    if(line)return cells[line[0]]==='O'?10-depth:depth-10;
    const empty=cells.flatMap((v,i)=>v?[]:[i]);if(!empty.length)return 0;
    return (turn==='O'?Math.max:Math.min)(...empty.map(i=>{cells[i]=turn;const score=search(cells,turn==='O'?'X':'O',depth+1);cells[i]='';return score;}));
  }
  let best=-Infinity,move=-1;
  for(const i of [4,0,2,6,8,1,3,5,7])if(!board[i]){board[i]='O';const score=search(board,'X',0);board[i]='';if(score>best){best=score;move=i;}}
  return move;
}
export function createGame(id,{random=Math.random,onFinish=()=>{},onCue=()=>{}}={}) {
  const s={id,mode:'menu',time:0,elapsed:0,score:0,round:1,opponent:'cpu',notice:'',result:null};
  const choose=n=>Math.min(n-1,Math.floor(random()*n));
  function finish(value,display,detail,extra={}){if(s.mode!=='playing')return;s.mode='result';s.result={value,display,detail,...extra};onCue('finish');onFinish(s.result);}
  function board(){s.bricks=Array.from({length:48},(_,i)=>({x:24+i%8*57,y:48+Math.floor(i/8)*27,w:51,h:19,row:Math.floor(i/8),alive:true}));s.ball={x:s.paddle,y:447,vx:0,vy:0};s.launched=false;s.trail=[];}
  function target(){let x,y;for(let attempt=0;attempt<12;attempt++){x=9+random()*82;y=12+random()*76;if(!s.target||Math.hypot(x-s.target.x,y-s.target.y)>=22)break;}if(s.target&&Math.hypot(x-s.target.x,y-s.target.y)<22){x=s.target.x<50?82:18;y=s.target.y<50?80:20;}s.target={x,y};}
  function pattern(){const pool=Array.from({length:16},(_,i)=>i);for(let i=pool.length-1;i>0;i--){const j=choose(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}s.pattern=pool.slice(0,Math.min(3+s.level-1,12));s.selected=[];s.phase='show';s.phaseLeft=Math.max(1.1,2.1-s.level*.05);}
  function prepare(){
    Object.assign(s,{elapsed:0,score:0,round:1,notice:'',result:null,countdown:3});
    if(id==='bricks'){Object.assign(s,{lives:3,level:1,paddle:252,paddleWidth:88,keys:{},trail:[]});board();}
    if(id==='tic-tac-toe'){Object.assign(s,{board:Array(9).fill(''),turn:'X',cpuLeft:0,winning:[]});}
    if(id==='reaction')Object.assign(s,{phase:'wait',wait:1.5+random()*3.5,greenAt:0,times:[],falseStarts:0});
    if(id==='aim'){s.hits=0;s.misses=0;target();}
    if(id==='stop-ten')s.stopped=null;
    if(id==='type'){s.words=Array.from({length:180},()=>WORDS[choose(WORDS.length)]);s.wordAt=0;s.correctChars=0;s.keystrokes=0;s.correctKeys=0;s.input='';s.typed=[];s.accuracy=100;s.wpm=0;}
    if(id==='memory'){s.level=1;s.wrong=null;pattern();}
  }
  function start(){prepare();s.mode=id==='tic-tac-toe'?'playing':'countdown';onCue('start');}
  function react(){
    if(s.phase==='early'){s.phase='wait';s.wait=1.5+random()*3.5;s.notice='';return;}
    if(s.phase==='wait'){s.phase='early';s.falseStarts++;onCue('wrong');return;}
    if(s.phase==='green'){const ms=Math.max(1,Math.round((s.elapsed-s.greenAt)*1000));s.times.push(ms);s.phase='caught';s.notice=ms+' ms';onCue('hit');return;}
    if(s.phase==='caught'){if(s.times.length===5){const best=Math.min(...s.times);finish(best,best+' ms','Fastest of five · '+Math.round(s.times.reduce((a,b)=>a+b,0)/5)+' ms average',{times:[...s.times]});}else{s.round++;s.phase='wait';s.wait=1.5+random()*3.5;s.notice='';}}
  }
  function tic(i){if(s.board[i]||s.cpuLeft>0)return;s.board[i]=s.turn;onCue('hit');const line=winner(s.board);if(line){s.winning=line;const won=s.opponent==='local'||s.turn==='X';finish(won?1:0,s.turn+' wins',s.opponent==='cpu'?(s.turn==='X'?'You won.':'The computer takes this round.'):'Three in a row.',{won,player:s.turn});return;}if(s.board.every(Boolean)){finish(0,'A draw','One more round?',{won:false});return;}s.turn=s.turn==='X'?'O':'X';if(s.opponent==='cpu'&&s.turn==='O')s.cpuLeft=.42;}
  function action(kind,value){
    if(s.mode!=='playing')return;
    if(id==='bricks'&&kind==='primary'&&!s.launched){s.launched=true;const speed=260+s.level*35;s.ball.vx=speed*.38;s.ball.vy=-speed*.925;onCue('hit');}
    if(id==='tic-tac-toe'&&kind==='cell')tic(Number(value));
    if(id==='reaction'&&kind==='primary')react();
    if(id==='aim'){
      if(kind==='hit'){s.hits++;s.score+=10;target();onCue('hit');}
      if(kind==='miss'){s.misses++;onCue('wrong');}
    }
    if(id==='stop-ten'&&kind==='primary'){s.stopped=s.elapsed;const error=Math.abs(s.elapsed-10);finish(error,s.elapsed.toFixed(2)+' s',error.toFixed(3)+' seconds from perfect.');}
    if(id==='click'&&kind==='primary'){s.score++;onCue('hit');}
    if(id==='memory'&&kind==='cell'&&s.phase==='recall'){
      const i=Number(value);if(s.selected.includes(i))return;
      if(!s.pattern.includes(i)){s.wrong=i;finish(s.score,s.score+' pts','Level '+s.level+' · pattern revealed.');return;}
      s.selected.push(i);onCue('hit');if(s.selected.length===s.pattern.length){s.score+=100;s.phase='cleared';s.phaseLeft=.75;onCue('level');}
    }
    if(id==='type'&&kind==='commit'&&s.input.trim()){
      const text=s.input.trim(),word=s.words[s.wordAt];if(text===word)s.correctChars+=word.length+1;
      s.typed.push({word,text,correct:text===word});s.wordAt++;s.input='';onCue(text===word?'hit':'wrong');
      if(s.wordAt>=s.words.length){s.words.push(...Array.from({length:100},()=>WORDS[choose(WORDS.length)]));}
      typeStats();
    }
  }
  function input(text,added=0,insertAt){if(id!=='type'||s.mode!=='playing')return;s.input=text.slice(0,32);const word=s.words[s.wordAt];if(added>0){s.keystrokes+=added;const start=Math.max(0,Number.isFinite(insertAt)?insertAt:s.input.length-added);for(let i=start;i<Math.min(s.input.length,start+added);i++)if(s.input[i]===word[i])s.correctKeys++;}typeStats();}
  function typeStats(){s.accuracy=s.keystrokes?Math.round(s.correctKeys/s.keystrokes*100):100;s.wpm=Math.round(s.correctChars/5/Math.max(s.elapsed/60,1/60));s.score=s.wpm;}
  function bricks(dt){
    const dir=(s.keys.right?1:0)-(s.keys.left?1:0);s.paddle=Math.max(24+s.paddleWidth/2,Math.min(480-s.paddleWidth/2,s.paddle+dir*440*dt));
    if(!s.launched){s.ball.x=s.paddle;s.ball.y=447;return;}
    const steps=Math.max(1,Math.ceil(Math.min(dt,.15)/.005)),step=Math.min(dt,.15)/steps;
    for(let n=0;n<steps&&s.mode==='playing'&&s.launched;n++){
      const b=s.ball,px=b.x,py=b.y;b.x+=b.vx*step;b.y+=b.vy*step;
      if(b.x<16){b.x=16;b.vx=Math.abs(b.vx);}if(b.x>488){b.x=488;b.vx=-Math.abs(b.vx);}if(b.y<16){b.y=16;b.vy=Math.abs(b.vy);}
      if(b.vy>0&&py<=447&&b.y>=447&&Math.abs(b.x-s.paddle)<=s.paddleWidth/2+7){const offset=Math.max(-1,Math.min(1,(b.x-s.paddle)/(s.paddleWidth/2)));const speed=Math.min(490,Math.hypot(b.vx,b.vy)+4);b.vx=Math.sin(offset*1.05)*speed;b.vy=-Math.cos(offset*1.05)*speed;b.y=447;onCue('hit');}
      for(const brick of s.bricks)if(brick.alive&&b.x+7>brick.x&&b.x-7<brick.x+brick.w&&b.y+7>brick.y&&b.y-7<brick.y+brick.h){brick.alive=false;s.score+=10;if(px+7<=brick.x||px-7>=brick.x+brick.w)b.vx*=-1;else b.vy*=-1;onCue('hit');if(!s.bricks.some(v=>v.alive)){if(s.level===3){finish(s.score,s.score+' pts','All three boards cleared.',{won:true});return;}s.level++;board();onCue('level');return;}break;}
      if(b.y>510){s.lives--;if(!s.lives){finish(s.score,s.score+' pts','Level '+s.level+' · all lives used.');return;}s.launched=false;s.trail=[];s.ball={x:s.paddle,y:447,vx:0,vy:0};return;}
    }
    s.trail.push({x:s.ball.x,y:s.ball.y});if(s.trail.length>12)s.trail.shift();
  }
  function step(dt){
    s.time+=dt;
    if(s.mode==='countdown'){s.countdown-=dt;if(s.countdown<=0){const remaining=-s.countdown;s.mode='playing';s.elapsed=0;onCue('go');if(remaining)step(remaining);}return;}
    if(s.mode!=='playing')return;
    s.elapsed+=dt;
    if(id==='bricks')bricks(dt);
    if(id==='tic-tac-toe'&&s.cpuLeft>0){s.cpuLeft-=dt;if(s.cpuLeft<=0){s.cpuLeft=0;tic(bestMove(s.board));}}
    if(id==='reaction'&&s.phase==='wait'){s.wait-=dt;if(s.wait<=0){s.phase='green';s.greenAt=s.elapsed;onCue('go');}}
    if(id==='reaction'&&s.phase==='green'&&s.elapsed-s.greenAt>10){s.phase='early';s.notice='Time out';}
    if(id==='memory'&&s.phase!=='recall'){s.phaseLeft-=dt;if(s.phaseLeft<=0){if(s.phase==='cleared'){s.level++;pattern();}else s.phase='recall';}}
    if(id==='stop-ten'&&s.elapsed>=30)finish(20,'30.00 s','Clock expired · 20.000 seconds off.');
    if(id==='type')typeStats();
    if((id==='aim'||id==='type')&&s.elapsed>=30){s.elapsed=30;if(id==='type'){if(s.input===s.words[s.wordAt])s.correctChars+=s.input.length;typeStats();finish(s.wpm,s.wpm+' WPM',s.accuracy+'% accuracy · '+s.typed.filter(w=>w.correct).length+' correct words',{accuracy:s.accuracy});}else finish(s.score,s.score+' pts',s.hits+' targets · '+s.misses+' misses');}
    if(id==='click'&&s.elapsed>=10){s.elapsed=10;finish(s.score,s.score+' clicks',(s.score/10).toFixed(1)+' clicks per second');}
  }
  function pause(){if(['playing','countdown'].includes(s.mode)){s.previousMode=s.mode;s.mode='paused';s.keys={};}}
  function resume(){if(s.mode==='paused')s.mode=s.previousMode;}
  function paddle(x){s.paddle=Math.max(24+s.paddleWidth/2,Math.min(480-s.paddleWidth/2,x));}
  return {s,start,step,action,input,pause,resume,paddle};
}
