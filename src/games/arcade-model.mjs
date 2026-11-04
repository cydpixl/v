export const MULTIPLAYER_GAMES=['tic-tac-toe','rock-paper-scissors','connect-four','slither'];
const reject=message=>{throw Object.assign(Error(message),{status:409})};
export function createArcadeState(game,players){
 if(!MULTIPLAYER_GAMES.includes(game)||players.length!==2||players[0]===players[1])throw Error('Invalid game');
 return {game,players,mode:'waiting',ready:[],revision:0,round:1,scores:[0,0],winner:'',board:Array(game==='connect-four'?42:9).fill(''),turn:players[0],choices:{},revealed:null};
}
function begin(s){
 const scores=s.scores,round=s.round+(s.mode==='round-over'?1:0),revision=s.revision,players=s.players,game=s.game;
 const next=createArcadeState(game,players);Object.assign(s,next,{mode:'playing',revision,round,scores});
 if(game==='slither'){
  s.width=1600;s.height=1000;s.elapsed=0;s.timeLimit=120;s.food=Array.from({length:100},(_,i)=>({id:i,x:35+Math.random()*1530,y:35+Math.random()*930,r:3+Math.random()*3,color:i%5}));
  s.snakes=players.map((uid,index)=>({uid,x:index?1200:400,y:500,angle:index?Math.PI:0,target:index?Math.PI:0,boost:false,alive:true,length:28,score:0,body:Array.from({length:28},(_,i)=>({x:(index?1200:400)+(index?i:-i)*6,y:500}))}));
 }
}
function finish(s,winner){s.winner=winner;s.mode='finished';s.ready=[];if(winner!=='draw')s.scores[s.players.indexOf(winner)]++}
export function arcadeAction(s,uid,action){
 if(!s.players.includes(uid))reject('You are not in this game.');
 if(action.type==='ready'){
  if(!['waiting','finished','round-over'].includes(s.mode))reject('The game is already running.');
  if(!s.ready.includes(uid))s.ready.push(uid);
  if(s.ready.length===2){if(s.mode==='finished'){s.round=1;if(s.game==='rock-paper-scissors')s.scores=[0,0]}begin(s)}
 }else if(s.game==='slither'&&action.type==='steer'){
  if(s.mode!=='playing'||!Number.isFinite(action.angle)||Math.abs(action.angle)>Math.PI*2||typeof action.boost!=='boolean')reject('Invalid steering.');
  const snake=s.snakes.find(snake=>snake.uid===uid);snake.target=action.angle;snake.boost=action.boost;return;
 }else if(s.game==='rock-paper-scissors'&&action.type==='choose'){
  if(s.mode!=='playing'||!['rock','paper','scissors'].includes(action.choice)||s.choices[uid])reject('Choose once each round.');
  s.choices[uid]=action.choice;
  if(s.players.every(player=>s.choices[player])){
   const [a,b]=s.players.map(player=>s.choices[player]);const winner=a===b?'draw':({rock:'scissors',paper:'rock',scissors:'paper'}[a]===b?s.players[0]:s.players[1]);
   s.revealed={...s.choices,winner};s.choices={};s.ready=[];
   if(winner!=='draw')s.scores[s.players.indexOf(winner)]++;
   if(s.scores.some(score=>score>=3)){s.winner=s.players[s.scores.findIndex(score=>score>=3)];s.mode='finished'}else s.mode='round-over';
  }
 }else if(action.type==='move'&&['tic-tac-toe','connect-four'].includes(s.game)){
  if(s.mode!=='playing'||s.turn!==uid||action.revision!==s.revision)reject('Wait for your turn. The board may have changed.');
  let cell=action.cell;
  if(s.game==='connect-four'){
   if(!Number.isInteger(action.column)||action.column<0||action.column>6)reject('Choose a column.');
   cell=-1;for(let row=5;row>=0;row--)if(!s.board[row*7+action.column]){cell=row*7+action.column;break}
  }
  if(!Number.isInteger(cell)||cell<0||cell>=s.board.length||s.board[cell])reject('Choose an empty space.');
  const mark=uid===s.players[0]?'X':'O';s.board[cell]=mark;s.lastMove=cell;
  let line=null;
  if(s.game==='tic-tac-toe')line=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(line=>line.every(i=>s.board[i]===mark));
  else{const row=Math.floor(cell/7),col=cell%7;for(const [dx,dy]of [[1,0],[0,1],[1,1],[1,-1]]){const run=[cell];for(const direction of [-1,1])for(let n=1;n<4;n++){const x=col+dx*n*direction,y=row+dy*n*direction;if(x<0||x>6||y<0||y>5||s.board[y*7+x]!==mark)break;run.push(y*7+x)}if(run.length>=4){line=run;break}}}
  if(line){s.winningLine=line;finish(s,uid)}else if(s.board.every(Boolean))finish(s,'draw');else s.turn=s.players.find(player=>player!==uid);
 }else reject('Invalid game action.');
 s.revision++;
}
export function publicArcadeState(s,uid){
 const view=structuredClone(s);
 if(s.game==='rock-paper-scissors'){view.locked=Object.keys(s.choices);view.choices=s.choices[uid]?{[uid]:s.choices[uid]}:{}}
 return view;
}
export function stepSlither(s,dt){
 if(s.game!=='slither'||s.mode!=='playing')return;
 dt=Math.min(.1,Math.max(0,dt));s.elapsed+=dt;
 for(const snake of s.snakes){
  if(!snake.alive)continue;
  const difference=Math.atan2(Math.sin(snake.target-snake.angle),Math.cos(snake.target-snake.angle));snake.angle+=Math.max(-3.8*dt,Math.min(3.8*dt,difference));
  const boosting=snake.boost&&snake.length>22,speed=boosting?215:130;snake.x+=Math.cos(snake.angle)*speed*dt;snake.y+=Math.sin(snake.angle)*speed*dt;
  if(boosting)snake.length=Math.max(22,snake.length-dt*2.5);
  snake.body.unshift({x:Math.round(snake.x),y:Math.round(snake.y)});snake.body.length=Math.min(snake.body.length,Math.ceil(snake.length));
  if(snake.x<12||snake.y<12||snake.x>s.width-12||snake.y>s.height-12)snake.alive=false;
  for(const food of s.food)if(Math.hypot(food.x-snake.x,food.y-snake.y)<13){snake.score+=10;snake.length=Math.min(160,snake.length+2);food.x=25+Math.random()*(s.width-50);food.y=25+Math.random()*(s.height-50)}
 }
 const killed=new Set();for(const snake of s.snakes)for(const other of s.snakes)if(snake!==other&&other.alive&&snake.alive&&other.body.some(point=>Math.hypot(point.x-snake.x,point.y-snake.y)<11))killed.add(snake.uid);
 for(const snake of s.snakes)if(killed.has(snake.uid))snake.alive=false;
 const living=s.snakes.filter(snake=>snake.alive);
 if(living.length<2)finish(s,living[0]?.uid||'draw');
 else if(s.elapsed>=s.timeLimit){const [a,b]=s.snakes;finish(s,a.score===b.score?'draw':a.score>b.score?a.uid:b.uid)}
}
