export const GAMES = [{id:'tic-tac-toe',name:'Tic tac toe',icon:'Grid3X3'},{id:'connect-four',name:'Connect four',icon:'Circle'},{id:'pong',name:'Pong',icon:'Columns2'}];
export function winner(board, rows, cols, run) {
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(board[y*cols+x])for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    let ok=true;for(let k=1;k<run;k++){const xx=x+dx*k,yy=y+dy*k;if(xx<0||xx>=cols||yy<0||yy>=rows||board[yy*cols+xx]!==board[y*cols+x]){ok=false;break;}}
    if(ok)return board[y*cols+x];
  }return board.every(Boolean)?'draw':null;
}
export function ticMove(board) {
  function score(b,turn){const w=winner(b,3,3,3);if(w)return w==='draw'?0:w===2?10:-10;const options=b.map((v,i)=>v?null:i).filter(i=>i!==null);return (turn===2?Math.max:Math.min)(...options.map(i=>{b[i]=turn;const n=score(b,3-turn);b[i]=0;return n;}));}
  let best=-Infinity,index=-1;for(const i of [4,0,2,6,8,1,3,5,7])if(!board[i]){board[i]=2;const value=score(board,1);board[i]=0;if(value>best){best=value;index=i;}}return index;
}
export function drop(board,col,side){for(let row=5;row>=0;row--)if(!board[row*7+col]){board[row*7+col]=side;return row*7+col;}return -1;}
export function fourMove(board){
  const cols=[3,2,4,1,5,0,6].filter(col=>!board[col]);
  for(const side of [2,1])for(const col of cols){const b=[...board];drop(b,col,side);if(winner(b,6,7,4)===side)return col;}
  function score(b,depth,turn){const w=winner(b,6,7,4);if(w)return w==='draw'?0:w===2?10000+depth:-10000-depth;if(!depth){let v=0;for(let r=0;r<6;r++)v+=(b[r*7+3]===2?3:b[r*7+3]===1?-3:0);return v;}const options=[3,2,4,1,5,0,6].filter(c=>!b[c]);return (turn===2?Math.max:Math.min)(...options.map(c=>{const a=[...b];drop(a,c,turn);return score(a,depth-1,3-turn);}));}
  let best=-Infinity,index=cols[0];for(const col of cols){const b=[...board];drop(b,col,2);const v=score(b,3,1);if(v>best){best=v;index=col;}}return index;
}
export function flips(board,index,side){if(board[index])return [];const found=[],x=index%8,y=Math.floor(index/8);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){let xx=x+dx,yy=y+dy,path=[];while(xx>=0&&xx<8&&yy>=0&&yy<8&&board[yy*8+xx]===3-side){path.push(yy*8+xx);xx+=dx;yy+=dy;}if(path.length&&xx>=0&&xx<8&&yy>=0&&yy<8&&board[yy*8+xx]===side)found.push(...path);}return found;}
export function startGame(host,id,icon) {
  let destroyed=false,busy=false,raf,timeout,board=[],status='Your turn',turn=1,score=[0,0],selected=[],matched=new Set(),known=new Map(),cards=[];
  host.innerHTML=`<header class="inline-game-head"><strong>${GAMES.find(g=>g.id===id)?.name}</strong><button type="button" data-restart aria-label="Restart game">${icon('RotateCcw')}</button><button type="button" data-stop aria-label="Close game">${icon('X')}</button></header><p class="inline-game-status" role="status"></p><div class="inline-game-board"></div>`;
  const stage=host.querySelector('.inline-game-board'),label=host.querySelector('.inline-game-status');
  const later=(fn,ms=360)=>{clearTimeout(timeout);timeout=setTimeout(()=>{if(!destroyed)fn();},ms);};
  function dispose(){destroyed=true;clearTimeout(timeout);cancelAnimationFrame(raf);window.removeEventListener('keydown',key);window.removeEventListener('keyup',keyUp);host.innerHTML='';}
  host.querySelector('[data-stop]').onclick=dispose;host.querySelector('[data-restart]').onclick=()=>{dispose();startGame(host,id,icon);};
  let pong=null,keys=new Set();const key=e=>{if(id==='pong'&&['ArrowUp','ArrowDown','w','s'].includes(e.key)){e.preventDefault();keys.add(e.key);}},keyUp=e=>keys.delete(e.key);
  function render(){label.textContent=status;
    if(id==='pong')return;
    const columns=id==='connect-four'?7:id==='reversi'?8:id==='memory'?4:3;stage.style.setProperty('--columns',columns);
    stage.innerHTML=board.map((v,i)=>`<button type="button" class="game-cell ${v===1?'one':v===2?'two':''} ${id==='memory'&&matched.has(i)?'matched':''}" data-cell="${i}" aria-label="${id==='connect-four'?'Column '+(i%7+1):'Cell '+(i+1)}" ${busy||((id==='tic-tac-toe'||id==='reversi')&&v)||matched.has(i)?'disabled':''}>${id==='memory'?selected.includes(i)||matched.has(i)?icon(cards[i]):icon('CircleHelp'):id==='tic-tac-toe'?v?icon(v===1?'X':'Circle'):'':v?'<i></i>':''}</button>`).join('');
  }
  function finish(w){if(w){status=w==='draw'?'Draw · play again':w===1?'You win!':'AI wins · try again';busy=true;return true;}return false;}
  function reverseTurn(){const options=board.map((_,i)=>({i,f:flips(board,i,2)})).filter(o=>o.f.length);if(options.length){options.sort((a,b)=>([0,7,56,63].includes(b.i)?100:0)+b.f.length-([0,7,56,63].includes(a.i)?100:0)-a.f.length);const move=options[0];board[move.i]=2;move.f.forEach(i=>board[i]=2);}
    const ours=board.some((_,i)=>flips(board,i,1).length),theirs=board.some((_,i)=>flips(board,i,2).length);
    if(!ours&&!theirs){const a=board.filter(v=>v===1).length,b=board.filter(v=>v===2).length;status=`${a===b?'Draw':a>b?'You win!':'AI wins'} · ${a}–${b}`;busy=true;}
    else if(!ours){status='No legal move · AI plays';later(reverseTurn);}
    else{busy=false;status='Your turn · '+board.filter(v=>v===1).length+'–'+board.filter(v=>v===2).length;}render();
  }
  function memoryTurn(){const pairs=new Map();for(const [i,value]of known)if(!matched.has(i)){const group=pairs.get(value)||[];group.push(i);pairs.set(value,group);}let choice=[...pairs.values()].find(v=>v.length>=2)?.slice(0,2);if(!choice){const available=cards.map((_,i)=>i).filter(i=>!matched.has(i));choice=available.sort(()=>Math.random()-.5).slice(0,2);}if(!choice?.length)return;selected=choice;choice.forEach(i=>known.set(i,cards[i]));render();later(()=>resolveMemory(2),650);}
  function resolveMemory(side){const hit=cards[selected[0]]===cards[selected[1]];if(hit){selected.forEach(i=>matched.add(i));score[side-1]++;}selected=[];
    if(matched.size===cards.length){status=`${score[0]===score[1]?'Draw':score[0]>score[1]?'You win!':'AI wins'} · ${score[0]}–${score[1]}`;busy=true;render();return;}
    turn=hit?side:3-side;busy=turn===2;status=`${turn===1?'Your turn':'AI is thinking'} · ${score[0]}–${score[1]}`;render();if(turn===2)later(memoryTurn,500);
  }
  stage.onclick=e=>{const button=e.target.closest('[data-cell]');if(!button||busy)return;const i=+button.dataset.cell;
    if(id==='memory'){if(selected.includes(i)||matched.has(i))return;selected.push(i);known.set(i,cards[i]);render();if(selected.length===2){busy=true;render();later(()=>resolveMemory(1),650);}return;}
    if(id==='reversi'){const changes=flips(board,i,1);if(!changes.length){status='Choose a square that flips a disc';render();return;}board[i]=1;changes.forEach(n=>board[n]=1);busy=true;status='AI is thinking';render();later(reverseTurn);return;}
    if(id==='connect-four'){if(drop(board,i%7,1)<0)return;}else{if(board[i])return;board[i]=1;}
    const w=winner(board,id==='connect-four'?6:3,id==='connect-four'?7:3,id==='connect-four'?4:3);if(finish(w)){render();return;}busy=true;status='AI is thinking';render();later(()=>{if(id==='connect-four')drop(board,fourMove(board),2);else board[ticMove(board)]=2;busy=false;status='Your turn';finish(winner(board,id==='connect-four'?6:3,id==='connect-four'?7:3,id==='connect-four'?4:3));render();});
  };
  if(id==='pong'){
    stage.innerHTML='<canvas width="560" height="340" tabindex="0" aria-label="Pong. Move pointer, or use up and down arrows."></canvas>';const canvas=stage.firstChild,ctx=canvas.getContext('2d');
    pong={x:280,y:170,vx:200,vy:130,player:130,ai:130,score:[0,0],playing:true};status='Move pointer or ↑ ↓ · first to 5';
    window.addEventListener('keydown',key);window.addEventListener('keyup',keyUp);
    canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect();pong.player=Math.max(0,Math.min(260,(e.clientY-r.top)*340/r.height-40));};
    function step(dt){if(!pong.playing)return;if(keys.has('ArrowUp')||keys.has('w'))pong.player-=270*dt;if(keys.has('ArrowDown')||keys.has('s'))pong.player+=270*dt;pong.player=Math.max(0,Math.min(260,pong.player));pong.ai+=Math.max(-180*dt,Math.min(180*dt,pong.y-40-pong.ai));pong.ai=Math.max(0,Math.min(260,pong.ai));pong.x+=pong.vx*dt;pong.y+=pong.vy*dt;if(pong.y<8||pong.y>332){pong.y=Math.max(8,Math.min(332,pong.y));pong.vy*=-1;}
      if(pong.vx<0&&pong.x<=30&&pong.x>=12&&pong.y>pong.player&&pong.y<pong.player+80){pong.vx=Math.min(420,-pong.vx*1.07);pong.vy=(pong.y-pong.player-40)*5;pong.x=31;}
      if(pong.vx>0&&pong.x>=530&&pong.x<=548&&pong.y>pong.ai&&pong.y<pong.ai+80){pong.vx=Math.max(-420,-pong.vx*1.07);pong.vy=(pong.y-pong.ai-40)*5;pong.x=529;}
      if(pong.x<0||pong.x>560){pong.score[pong.x>560?0:1]++;pong.x=280;pong.y=170;pong.vx=pong.x>560?-200:200;pong.vy=130;if(pong.score.some(s=>s>=5)){pong.playing=false;status=pong.score[0]>=5?'You win!':'AI wins · try again';}else status=`${pong.score[0]}–${pong.score[1]} · Move pointer or ↑ ↓`;}}
    function draw(){ctx.fillStyle='#151821';ctx.fillRect(0,0,560,340);ctx.strokeStyle='#333847';ctx.setLineDash([6,9]);ctx.beginPath();ctx.moveTo(280,0);ctx.lineTo(280,340);ctx.stroke();ctx.fillStyle='#9ca7ff';ctx.fillRect(18,pong.player,10,80);ctx.fillStyle='#e5a99b';ctx.fillRect(532,pong.ai,10,80);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pong.x,pong.y,7,0,Math.PI*2);ctx.fill();ctx.font='bold 28px sans-serif';ctx.fillText(pong.score[0],240,40);ctx.fillText(pong.score[1],304,40);label.textContent=status;}
    let prev=performance.now();function loop(now){if(destroyed)return;step(Math.min(.035,(now-prev)/1000));prev=now;draw();raf=requestAnimationFrame(loop);}raf=requestAnimationFrame(loop);
    window.advanceTime=ms=>{for(let i=0;i<Math.ceil(ms/16.667);i++)step(1/60);draw();};
  }else{board=Array(id==='connect-four'?42:id==='reversi'?64:id==='memory'?16:9).fill(0);if(id==='reversi'){board[27]=board[36]=2;board[28]=board[35]=1;}if(id==='memory'){const symbols=['Heart','Star','Moon','Sun','Music','Cloud','Zap','Flower'];cards=[...symbols,...symbols].sort(()=>Math.random()-.5);status='Find pairs · take turns with AI';}render();window.advanceTime=()=>{};}
  window.render_game_to_text=()=>JSON.stringify({game:id,status,busy,board,cards:id==='memory'?cards.map((c,i)=>matched.has(i)||selected.includes(i)?c:null):undefined,score,pong,coordinates:'origin top-left; x right, y down'});
  return dispose;
}
