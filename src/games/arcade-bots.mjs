import {Chess} from 'chess.js';
import {arcadeAction,reversiMoves,reversiFlips} from './arcade-model.mjs';
const pick=items=>items[Math.floor(Math.random()*items.length)];
export function botAction(s,uid,difficulty='normal'){
 if(s.mode!=='playing')return null;
 const revision=s.revision,random=difficulty==='easy',depth=difficulty==='hard'?5:3;
 if(s.game==='rock-paper-scissors')return s.choices[uid]?null:{type:'choose',choice:pick(['rock','paper','scissors'])};
 if(s.turn!==uid)return null;
 if(s.game==='chess'){
  const chess=new Chess(s.fen),moves=chess.moves({verbose:true}),values={p:100,n:320,b:330,r:500,q:900,k:20000};
  const evaluate=()=>chess.board().flat().reduce((score,p)=>score+(p?(p.color==='w'?1:-1)*(values[p.type]+(p.type==='p'?(p.color==='w'?Number(p.square[1])-2:7-Number(p.square[1]))*2:0)):0),0);
  function search(n,alpha,beta){if(chess.isCheckmate())return chess.turn()==='w'?-100000-n:100000+n;if(chess.isDraw())return 0;if(!n)return evaluate();let best=chess.turn()==='w'?-Infinity:Infinity,white=chess.turn()==='w';for(const move of chess.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0))){chess.move(move);const score=search(n-1,alpha,beta);chess.undo();best=white?Math.max(best,score):Math.min(best,score);if(white)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break}return best}
  let chosen=pick(moves),best=-Infinity; if(!random)for(const move of moves){const white=chess.turn()==='w';chess.move(move);const score=(white?1:-1)*search(difficulty==='hard'?2:1,-Infinity,Infinity)+Math.random()*.1;chess.undo();if(score>best){best=score;chosen=move}}
  return chosen?{type:'move',from:chosen.from,to:chosen.to,promotion:chosen.promotion||'q',revision}:null;
 }
 if(s.game==='reversi'){
  const mark=uid===s.players[0]?'X':'O',other=mark==='X'?'O':'X',moves=reversiMoves(s.board,mark);if(!moves.length)return null;if(random)return {type:'move',cell:pick(moves),revision};
  const corners=[0,7,56,63],danger=[[0,[1,8,9]],[7,[6,14,15]],[56,[48,49,57]],[63,[54,55,62]]];let visited=0;
  function evaluate(board){let score=board.reduce((sum,v,i)=>sum+(v?(v===mark?1:-1)*(corners.includes(i)?100:1):0),0);for(const [corner,near]of danger)if(!board[corner])for(const i of near)if(board[i])score+=(board[i]===mark?-18:18);return score+3*(reversiMoves(board,mark).length-reversiMoves(board,other).length)}
  function play(board,cell,color){const next=board.slice();next[cell]=color;for(const i of reversiFlips(board,cell,color))next[i]=color;return next}
  function search(board,color,n,alpha,beta){const legal=reversiMoves(board,color),enemy=color==='X'?'O':'X';if(!legal.length&&!reversiMoves(board,enemy).length){const difference=board.reduce((v,p)=>v+(p===mark?1:p===other?-1:0),0);return Math.sign(difference)*10000+difference}if(!n||++visited>18000)return evaluate(board);if(!legal.length)return search(board,enemy,n-1,alpha,beta);const max=color===mark;let best=max?-Infinity:Infinity;for(const cell of legal.sort((a,b)=>Number(corners.includes(b))-Number(corners.includes(a)))){const value=search(play(board,cell,color),enemy,n-1,alpha,beta);best=max?Math.max(best,value):Math.min(best,value);if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break}return best}
  let chosen=moves[0],best=-Infinity;for(const cell of moves.sort((a,b)=>Number(corners.includes(b))-Number(corners.includes(a)))){const value=search(play(s.board,cell,mark),other,difficulty==='hard'?3:1,-Infinity,Infinity);if(value>best){best=value;chosen=cell}}return {type:'move',cell:chosen,revision};
 }
 const moves=state=>state.game==='connect-four'?Array.from({length:7},(_,column)=>column).filter(c=>!state.board[c]).map(column=>({type:'move',column,revision:state.revision})):state.board.flatMap((v,cell)=>v?[]:[{type:'move',cell,revision:state.revision}]);
 const available=moves(s);if(random)return pick(available);
 function search(state,n,alpha,beta){if(state.mode==='finished')return state.winner==='draw'?0:state.winner===uid?10000+n:-10000-n;if(!n){if(state.game!=='connect-four')return 0;return state.board.reduce((sum,v,i)=>sum+(v?(v===(uid===state.players[0]?'X':'O')?1:-1)*(4-Math.abs(i%7-3)):0),0)}const max=state.turn===uid;let best=max?-Infinity:Infinity;for(const move of moves(state).sort((a,b)=>Math.abs((a.column??a.cell)-3)-Math.abs((b.column??b.cell)-3))){const next=structuredClone(state);arcadeAction(next,state.turn,move);const value=search(next,n-1,alpha,beta);best=max?Math.max(best,value):Math.min(best,value);if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break}return best}
 let best=-Infinity,chosen=available[0];for(const action of available){const next=structuredClone(s);arcadeAction(next,uid,action);const value=search(next,s.game==='tic-tac-toe'?9:depth,-Infinity,Infinity);if(value>best){best=value;chosen=action}}return chosen;
}
export function steerBot(s,snake){
 let best=-Infinity,angle=snake.angle;for(let n=-5;n<=5;n++){
  const target=snake.angle+n*.25,x=snake.x+Math.cos(target)*95,y=snake.y+Math.sin(target)*95;
  let score=Math.min(x,y,s.width-x,s.height-y)*.04-Math.abs(n)*.2;
  if(x<25||y<25||x>s.width-25||y>s.height-25)score-=1000;
  for(const other of s.snakes)if(other!==snake&&other.alive)for(let i=0;i<other.body.length;i+=3)if(Math.hypot(x-other.body[i].x,y-other.body[i].y)<65)score-=100;
  const food=s.food.reduce((near,f)=>Math.min(near,Math.hypot(x-f.x,y-f.y)),Infinity);score-=food*.1;
  if(score>best){best=score;angle=target}
 }snake.target=Math.atan2(Math.sin(angle),Math.cos(angle));snake.boost=false;
}
