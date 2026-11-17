import {arcadeGame} from './arcade.js';
import {puzzleGame} from './puzzles.js';
const META={
'meteor-dodge':['Meteor Dodge','Survive the falling meteor storm.','Move with ← →, A/D, or drag.','☄'],
'sky-glider':['Sky Glider','Fly between the barriers.','Space, click, or tap to flap.','➶'],
'neon-runner':['Neon Runner','Run, jump, and stay clear of blocks.','Space, ↑, or tap to jump.','⌁'],
'lane-drift':['Lane Drift','Steer through three lanes of traffic.','← → or tap a lane to steer.','≡'],
'color-catcher':['Color Catcher','Catch the target color. Avoid the others.','← → or drag your basket.','◉'],
'moving-targets':['Moving Targets','Hit as many moving targets as you can.','Click or tap each target.','◎'],
'pulse-guard':['Pulse Guard','Pulse when threats approach the station.','Space, click, or tap to release energy.','✴'],
'gravity-swap':['Gravity Swap','Swap sides to dodge upcoming hazards.','Space, click, or tap to flip gravity.','↕'],
'orbit-escape':['Orbit Escape','Reverse orbit to avoid incoming hazards.','Space, click, or tap to reverse.','◌'],
'laser-gates':['Laser Gates','Slip through each approaching gate.','← →, A/D, or drag.','╬'],
'word-search':['Word Search','Discover all five hidden words.','Select the starting and ending letters.','W'],
'word-scramble':['Word Scramble','Unscramble eight words.','Type a word and press Enter.','Aa'],
'code-breaker':['Code Breaker','Crack the secret four-digit code.','Enter four different digits.','✣'],
'math-rush':['Math Rush','Solve as many problems as you can.','Type the answer and press Enter.','∑'],
'higher-lower':['Higher or Lower','Guess the secret number in seven tries.','Guess a number from 1–99.','↟'],
'sequence-sprint':['Sequence Sprint','Find the next number in a sequence.','Type the missing term.','123'],
'maze-path':['Maze Path','Reach the exit through the maze.','Move one tile at a time, or step back.','◇'],
'peg-solitaire':['Peg Solitaire','Remove pegs by jumping over them.','Select a peg, then the empty destination.','●'],
'flood-grid':['Flood Grid','Make the entire grid one color.','Choose a color each turn.','▦'],
'seven-queens':['Seven Queens','Place seven queens without attacking.','Click to place or remove a queen.','♛'],
'domino-chain':['Domino Chain','Join tiles matching the open end.','Click a playable domino tile.','⚄'],
'dots-boxes':['Dots & Boxes','Claim more boxes than the computer.','Tap an empty line between two dots.','□'],
'tri-peaks':['Tri Peaks','Clear the three card peaks.','Play an exposed card one rank up or down.','♠'],
'number-trail':['Number Trail','Find every number in order.','Click 1 through 25 as quickly as possible.','25']
};
const slug=new URL(location.href).searchParams.get('game')||'meteor-dodge';
const meta=META[slug]||META['meteor-dodge'];
document.title=meta[0]+' · Vela Play';
const $=id=>document.getElementById(id);
$('name').textContent=meta[0];$('instructions').textContent=meta[2];$('emblem').textContent=meta[3];$('headline').textContent=meta[0];$('message').textContent=meta[1];
let instance=null, events=null, score=0, best=0, elapsed=0, running=false, paused=false, last=0;
const key='vela.play.best.'+slug;
try{best=Number(localStorage.getItem(key)||0)||0;}catch{}
$('best').textContent=String(best);
const show=(title,message,action)=>{$('headline').textContent=title;$('message').textContent=message;$('start').firstChild.textContent=action+' ';$('overlay').hidden=false;};
const hide=()=>{$('overlay').hidden=true;};
function update(){
 $('score').textContent=String(score);
 $('best').textContent=String(best);
 $('time').textContent=Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
}
function finish(message='Round complete'){
 if(!running)return;
 running=false;paused=false;$('pause').disabled=true;
 const record=score>best;if(record){best=score;try{localStorage.setItem(key,String(best));}catch{}}
 update();show(message,'Score '+score+(record?' · New best!':''),'Play again');
}
function makeContext(){
 return {
  area:$('arena'),
  on(target,type,fn,options={}){target.addEventListener(type,fn,{...options,signal:events.signal});},
  add(n=1){score+=n;update();},
  set(n){score=Math.max(0,Math.round(n));update();},
  end:finish,
  hint(s){$('hint').textContent=s;},
  get score(){return score;},
  get elapsed(){return elapsed;},
  get paused(){return paused;}
 };
}
function start(){
 events?.abort();instance?.destroy?.();instance=null;
 score=0;elapsed=0;running=true;paused=false;last=performance.now();update();
 $('arena').replaceChildren();$('hint').textContent='Keyboard · Mouse · Touch';$('pause').disabled=false;$('pause').textContent='Pause';events=new AbortController();
 const ctx=makeContext();
 try{instance=arcadeGame(slug,ctx)||puzzleGame(slug,ctx);if(!instance)throw Error('Unknown game');hide();}
 catch(error){console.error('Game failed to start:',error);finish('Could not start game');$('message').textContent='This game could not be loaded.';}
}
$('start').addEventListener('click',()=>{if(paused){paused=false;last=performance.now();$('pause').textContent='Pause';hide();return;}start();});
$('restart').addEventListener('click',start);
$('pause').addEventListener('click',()=>{if(!running)return;paused=!paused;if(paused){show('Paused','Your game is on hold.','Resume');$('pause').textContent='Resume';}else{last=performance.now();hide();$('pause').textContent='Pause';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused){paused=true;show('Paused','The game paused while you were away.','Resume');$('pause').textContent='Resume';}});
function loop(now){
 const dt=Math.min(.06,Math.max(0,(now-last)/1000));last=now;
 if(running&&!paused){elapsed+=dt;try{instance?.tick?.(dt);}catch(e){console.error('Game loop stopped:',e);finish('Game stopped');}update();}
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
