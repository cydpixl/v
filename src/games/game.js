import {mountArcade} from './arcade.mjs';
import {gameDefinition,gameIcon} from './catalog.mjs';
import {createGame} from './model.mjs';
import {readScores,rankedScores,saveScore,formatBest} from './scores.mjs';
import {gameAudio} from './audio.js';
import './games.css';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountVelaGame(root,{id,owner='device',api}={}){
  const game=gameDefinition(id);if(!game)throw Error('Unknown game.');if(game.multiplayer)return mountArcade(root,{id,owner,api});
  const events=new AbortController();let alive=true,raf,last=performance.now(),splash=0,view='',period='all',saved=true,muted=false;
  try{muted=localStorage.getItem('vela.games.muted.'+owner)==='1';}catch{}
  const shell=document.createElement('section');shell.className='vg vg-game-'+id;shell.style.setProperty('--game-accent',game.accent);shell.style.setProperty('--game-ink',game.ink);shell.tabIndex=-1;shell.setAttribute('aria-label',game.name);root.append(shell);root.closest('.desktop-window')?.classList.add('vg-window');
  const audio=gameAudio(root,id,{muted});
  const model=createGame(id,{onCue:audio.cue,onFinish:result=>{saved=saveScore(owner,id,result);}}),s=model.s;
  s.mode='splash';
  function focusActive(){return !root.closest('[hidden]')&&!document.hidden&&(!root.closest('.desktop-window')||root.closest('.desktop-window').classList.contains('window-front'));}
  let closeOnline;root.addEventListener('click',event=>{if(event.target.closest('[data-vg=online]')){closeOnline?.();shell.style.display='none';closeOnline=mountArcade(root,{id,api,owner,onBack:()=>{closeOnline?.();closeOnline=null;shell.style.display='';s.mode='menu';paint(true);setHooks()}})}},{signal:events.signal});
  function header(){return `<header class="vg-top"><button data-vg="menu" aria-label="Main menu">‹ <span>${escape(game.name)}</span></button><div><button data-vg="sound" aria-label="${muted?'Unmute':'Mute'} game sound" aria-pressed="${!muted}">${muted?'Sound off':'Sound on'}</button><button data-vg="fullscreen" aria-label="Toggle game fullscreen">⛶</button></div></header>`;}
  function best(){const top=rankedScores(owner,id)[0];return top?formatBest(id,top.value):'—';}
  function menu(){return `<div class="vg-menu vg-enter"><div class="vg-poster" aria-hidden="true"><i class="vg-orbit"></i><i class="vg-orbit second"></i><span class="vg-emblem">${gameIcon(id)}</span><span class="vg-spark a"></span><span class="vg-spark b"></span><span class="vg-spark c"></span></div><div class="vg-menu-copy"><small>${game.tag}</small><h1>${escape(game.name)}</h1><p>${escape(game.description)}</p>${id==='tic-tac-toe'?`<div class="vg-segments" aria-label="Opponent"><button data-vg="cpu" aria-pressed="${s.opponent==='cpu'}">Computer</button><button data-vg="local" aria-pressed="${s.opponent==='local'}">Same device</button>${api?'<button data-vg="online">Online with a friend</button>':''}</div>`:''}<button class="vg-primary" data-vg="play">Play <span>↗</span></button><button class="vg-score-link" data-vg="scores">Your scores <span>↗</span></button><div class="vg-menu-best"><span>PERSONAL BEST</span><strong>${best()}</strong></div><details><summary>How to play</summary><p>${game.controls}</p></details></div><footer class="vg-credit">VelaGames Studios</footer></div>`;}
  function scoreView(){const records=rankedScores(owner,id,period),all=readScores(owner,id);return `<div class="vg-scores vg-enter"><div class="vg-section-title"><small>YOUR RECORDS</small><h1>${escape(game.name)}</h1><span>Saved on this device</span></div><nav class="vg-segments" aria-label="Score period">${[['today','Today'],['week','Weekly'],['all','All Time']].map(([p,label])=>`<button data-period="${p}" aria-pressed="${period===p}">${label}</button>`).join('')}</nav><ol>${records.slice(0,10).map((r,i)=>`<li><span>${i+1}</span><div><strong>You</strong><small>${new Date(r.at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small></div><b>${escape(r.display)}</b></li>`).join('')||'<li class="vg-empty">Your first score starts here.</li>'}</ol><div class="vg-summary"><div><strong>${all.length}</strong><span>Games</span></div><div><strong>${best()}</strong><span>Best</span></div><div><strong>${id==='tic-tac-toe'?all.filter(r=>r.won).length:records.length}</strong><span>${id==='tic-tac-toe'?'Wins':'This period'}</span></div></div><button class="vg-primary" data-vg="play">Play again <span>↗</span></button></div>`;}
  function boardMarkup(){if(id==='tic-tac-toe')return `<div class="vg-tic" role="group" aria-label="Tic Tac Toe board">${s.board.map((mark,i)=>`<button data-cell="${i}" aria-label="Square ${i+1}${mark?', '+mark:''}" ${mark||s.cpuLeft>0?'disabled':''} class="${mark==='O'?'vg-o':''} ${s.winning.includes(i)?'vg-winner':''}">${mark==='X'?'×':mark==='O'?'○':''}</button>`).join('')}</div>`;if(id==='memory')return `<div class="vg-memory" role="group" aria-label="Memory Grid">${Array.from({length:16},(_,i)=>{const lit=(s.phase==='show'||s.mode==='result')&&s.pattern.includes(i),selected=s.selected.includes(i);return `<button data-cell="${i}" aria-label="Square ${i+1}${lit?', highlighted':selected?', selected':''}" class="${lit?'lit':''} ${selected?'selected':''} ${s.wrong===i?'wrong':''}" ${s.phase!=='recall'||selected||s.mode==='result'?'disabled':''}></button>`;}).join('')}</div>`;return '';}
  function playing(){
    let content='';
    if(id==='bricks')content='<canvas class="vg-bricks" width="504" height="504" tabindex="0" aria-label="Bricks vs Balls. Move paddle with mouse, touch or arrow keys. Space to launch."></canvas><button class="vg-launch" data-vg="primary">Launch ball</button>';
    if(id==='tic-tac-toe'||id==='memory')content='<p class="vg-prompt" aria-live="polite"></p><div data-board></div>';
    if(id==='reaction')content='<button class="vg-reaction" data-vg="primary"><span class="vg-reaction-symbol">●</span><strong></strong><small></small></button>';
    if(id==='aim')content='<div class="vg-aim-field" aria-label="Target field"><div class="vg-crosshair" aria-hidden="true"></div><button class="vg-target" data-vg="hit" aria-label="Hit target"><i></i></button></div>';
    if(id==='stop-ten')content='<button class="vg-timer-face" data-vg="primary" aria-label="Stop timer"><small>STOP AT</small><strong data-clock>0.00</strong><span>10.00 SECONDS</span><b>Stop the clock</b></button>';
    if(id==='type')content='<div class="vg-typing"><div class="vg-word-track" aria-hidden="true"></div><label for="vg-type-'+id+'">Type the highlighted word</label><input id="vg-type-'+id+'" class="vg-type-input" aria-label="Type the highlighted word" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="32" inputmode="text"><span class="vg-type-hint">Space to continue</span></div>';
    if(id==='click')content='<button class="vg-frenzy" data-vg="primary"><strong>0</strong><span>CLICK</span><i></i></button>';
    return `<div class="vg-play vg-enter"><div class="vg-hud"><div><small data-label>Score</small><strong data-value>0</strong></div><div class="vg-hud-side"><span data-extra></span><button data-vg="pause" aria-label="Pause game">Ⅱ</button></div></div><div class="vg-arena">${content}</div><div class="vg-bottom"><span data-hint></span><span>${escape(game.name)}</span></div></div>`;
  }
  function result(){return `<div class="vg-result vg-enter"><small>${s.result.won?'NICE WORK':'ROUND COMPLETE'}</small><div class="vg-result-mark">${gameIcon(id)}</div><h1>${escape(s.result.display)}</h1><p>${escape(s.result.detail)}</p>${['tic-tac-toe','memory'].includes(id)?boardMarkup():''}${id==='reaction'?'<div class="vg-round-times">'+s.times.map((v,i)=>`<span><small>${i+1}</small>${v} ms</span>`).join('')+'</div>':''}<div class="vg-result-actions"><button class="vg-primary" data-vg="play">Play again <span>↗</span></button><button data-vg="scores">Your scores ↗</button></div>${!saved?'<p role="status">This score could not be saved. Device storage is full.</p>':''}</div>`;}
  function paint(force=false){
    const key=s.mode==='paused'?'paused':s.mode;
    if(!force&&key===view){refresh();return;}view=key;
    if(key==='splash'){shell.innerHTML='<div class="vg-studio"><div class="vg-studio-logo"><span>V</span><strong>VelaGames</strong><small>STUDIOS</small></div></div>';return;}
    shell.innerHTML=header()+(key==='menu'?menu():key==='scores'?scoreView():key==='result'?result():key==='paused'?`<div class="vg-pause vg-enter"><small>TAKE A BREATH</small><h1>Paused</h1><button class="vg-primary" data-vg="resume">Resume <span>↗</span></button><button data-vg="menu">Main menu</button></div>`:key==='countdown'?`<div class="vg-countdown"><small>${escape(game.name)}</small><strong data-countdown>3</strong><span>Get ready</span></div>`:playing());
    refresh();if(key==='playing'){if(id==='type')shell.querySelector('input')?.focus();else (shell.querySelector('canvas')||shell).focus({preventScroll:true});}else if(key!=='splash')shell.querySelector('[data-vg="play"],[data-vg="resume"]')?.focus({preventScroll:true});
  }
  function text(selector,value){const node=shell.querySelector(selector);if(node&&node.textContent!==String(value))node.textContent=value;}
  let boardSignature='';
  function refresh(){
    if(s.mode==='countdown'){text('[data-countdown]',Math.max(1,Math.ceil(s.countdown)));return;}
    if(s.mode!=='playing')return;
    const label=id==='reaction'?'Round':id==='stop-ten'?'Target':id==='type'?'WPM':id==='memory'?'Level':id==='tic-tac-toe'?'Turn':'Score';
    text('[data-label]',label);text('[data-value]',id==='reaction'?s.round+' / 5':id==='stop-ten'?'10.00':id==='type'?s.wpm:id==='memory'?s.level:id==='tic-tac-toe'?s.turn:s.score);
    text('[data-extra]',id==='bricks'?'♥ '.repeat(s.lives)+' · '+s.level+'/3':id==='aim'?Math.max(0,30-s.elapsed).toFixed(1)+' s':id==='type'?s.accuracy+'% · '+Math.max(0,Math.ceil(30-s.elapsed))+' s':id==='click'?Math.max(0,10-s.elapsed).toFixed(1)+' s':id==='memory'?s.score+' pts':'');
    text('[data-hint]',id==='bricks'?'← → move · Space launch':id==='reaction'?'Space or tap':id==='memory'?'+100 per level':id==='type'?'30 seconds':id==='aim'?'+10 per target':id==='click'?'Space or tap':id==='stop-ten'?'Space or tap to stop':s.opponent==='cpu'?'VS COMPUTER':'TWO PLAYERS');
    if(id==='bricks'){drawBricks();shell.querySelector('.vg-launch').hidden=s.launched;}
    if(id==='tic-tac-toe'||id==='memory'){
      const signature=JSON.stringify([s.board,s.turn,s.cpuLeft>0,s.phase,s.selected,s.level]);const board=shell.querySelector('[data-board]');
      if(board&&(signature!==boardSignature||!board.children.length)){board.innerHTML=boardMarkup();boardSignature=signature;}
      text('.vg-prompt',id==='tic-tac-toe'?(s.cpuLeft>0?'Thinking…':s.turn+'’s turn'):s.phase==='show'?'Remember these squares':s.phase==='cleared'?'+100 · Pattern complete':'Repeat the pattern');
    }
    if(id==='reaction'){
      const button=shell.querySelector('.vg-reaction');button.dataset.phase=s.phase;
      text('.vg-reaction strong',s.phase==='wait'?'Wait for green':s.phase==='green'?'NOW':s.phase==='early'?(s.notice||'Too soon'):s.notice);
      text('.vg-reaction small',s.phase==='wait'?'Hold steady.':s.phase==='green'?'Click!':s.phase==='early'?'Tap to try this round again.':s.times.length===5?'Tap for results.':'Tap for the next round.');
    }
    if(id==='aim'){const target=shell.querySelector('.vg-target');target.style.left=s.target.x+'%';target.style.top=s.target.y+'%';}
    if(id==='stop-ten')text('[data-clock]',s.elapsed.toFixed(2));
    if(id==='click')text('.vg-frenzy strong',s.score);
    if(id==='type'){
      const track=shell.querySelector('.vg-word-track'),signature=s.wordAt+':'+s.input;if(track.dataset.signature!==signature){track.dataset.signature=signature;track.innerHTML=s.words.slice(s.wordAt,s.wordAt+12).map((word,i)=>`<span class="${i===0?'current':''}">${i===0?[...word].map((c,n)=>`<b class="${n<s.input.length?(s.input[n]===c?'correct':'incorrect'):''}">${c}</b>`).join(''):word}</span>`).join('');}
      const input=shell.querySelector('input');if(input.value!==s.input)input.value=s.input;
    }
  }
  function drawBricks(){
    const canvas=shell.querySelector('canvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,504,504);ctx.fillStyle='#111923';ctx.fillRect(0,0,504,504);
    ctx.strokeStyle='#ffffff07';ctx.lineWidth=1;for(let i=0;i<504;i+=28){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,504);ctx.moveTo(0,i);ctx.lineTo(504,i);ctx.stroke();}
    const colors=['#ff9b76','#ffb86b','#f7ce86','#b9dfac','#8ecfd0','#a7b8ec'];
    for(const b of s.bricks)if(b.alive){ctx.fillStyle=colors[b.row];ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,5);ctx.fill();ctx.fillStyle='#ffffff32';ctx.fillRect(b.x+4,b.y+2,b.w-8,2);}
    s.trail.forEach((p,i)=>{ctx.fillStyle=`rgba(255,225,180,${i/40})`;ctx.beginPath();ctx.arc(p.x,p.y,2+i/4,0,Math.PI*2);ctx.fill();});
    ctx.shadowColor=game.accent;ctx.shadowBlur=15;ctx.fillStyle=game.accent;ctx.beginPath();ctx.roundRect(s.paddle-s.paddleWidth/2,456,s.paddleWidth,11,6);ctx.fill();ctx.fillStyle='#fff8eb';ctx.beginPath();ctx.arc(s.ball.x,s.ball.y,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  function tick(){const now=performance.now(),dt=(now-last)/1000;last=now;if(focusActive()){if(s.mode==='splash'){splash+=dt;if(splash>=2.5){s.mode='menu';paint();}}else model.step(dt);}else if(['playing','countdown'].includes(s.mode)){model.pause();audio.stop();}paint();}
  function dispatch(action){tick();if(action==='play'){model.start();boardSignature='';}else if(action==='menu'){audio.stop();s.mode='menu';}else if(action==='scores')s.mode='scores';else if(action==='pause')model.pause();else if(action==='resume'){last=performance.now();model.resume();}else if(action==='cpu'||action==='local'){s.opponent=action;paint(true);}else if(action==='sound'){muted=!muted;try{localStorage.setItem('vela.games.muted.'+owner,muted?'1':'0');}catch{}audio.setMuted(muted);const b=shell.querySelector('[data-vg=sound]');b.textContent=muted?'Sound off':'Sound on';b.setAttribute('aria-label',(muted?'Unmute':'Mute')+' game sound');b.setAttribute('aria-pressed',String(!muted));}else if(action==='fullscreen'){const target=root.closest('.desktop-window')||shell;if(document.fullscreenElement===target)document.exitFullscreen?.().catch(()=>{});else target.requestFullscreen?.().catch(()=>{});}else model.action(action);paint();}
  shell.addEventListener('click',event=>{const cell=event.target.closest('[data-cell]');if(cell){tick();model.action('cell',Number(cell.dataset.cell));paint();return;}const tab=event.target.closest('[data-period]');if(tab){period=tab.dataset.period;paint(true);return;}const button=event.target.closest('[data-vg]');if(button)dispatch(button.dataset.vg);else if(event.target.closest('.vg-aim-field')){tick();model.action('miss');paint();}},{signal:events.signal});
  shell.addEventListener('pointerover',event=>{if(event.target.closest('.vg-menu button,.vg-top button,.vg-segments button'))audio.cue('hover');},{signal:events.signal});
  shell.addEventListener('pointerdown',event=>{shell.focus({preventScroll:true});if(event.target.closest('input'))event.target.focus();if(id==='bricks'&&event.target.closest('canvas')){event.preventDefault();event.target.setPointerCapture(event.pointerId);paddle(event);dispatch('primary');}const button=event.target.closest('.vg-frenzy');if(button){button.classList.remove('popped');void button.offsetWidth;button.classList.add('popped');}},{signal:events.signal});
  function paddle(event){const canvas=shell.querySelector('canvas');if(!canvas||s.mode!=='playing')return;const r=canvas.getBoundingClientRect();model.paddle((event.clientX-r.left)*504/r.width);drawBricks();}
  shell.addEventListener('pointermove',event=>{if(id==='bricks')paddle(event);},{signal:events.signal});
  shell.addEventListener('input',event=>{if(!event.target.matches('.vg-type-input'))return;const value=event.target.value,before=s.input,text=value.replace(/\s/g,''),added=event.inputType?.startsWith('delete')?0:typeof event.data==='string'?event.data.replace(/\s/g,'').length:Math.max(0,text.length-before.length),at=Math.max(0,(event.target.selectionStart??text.length)-added);tick();if(s.mode!=='playing')return;model.input(text,added,at);if(value.includes(' '))model.action('commit');paint();},{signal:events.signal});
  shell.addEventListener('paste',event=>{if(event.target.matches('.vg-type-input'))event.preventDefault();},{signal:events.signal});
  shell.addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();if(s.mode==='paused')dispatch('resume');else if(['playing','countdown'].includes(s.mode))dispatch('pause');return;}
    if(event.key.toLowerCase()==='f'&&!event.target.matches('input')){event.preventDefault();dispatch('fullscreen');return;}
    if(id==='type'&&event.target.matches('input')){if(event.key===' '||event.key==='Enter'){event.preventDefault();if(!event.repeat){tick();model.action('commit');paint();}}return;}
    if(s.mode!=='playing')return;
    if(id==='bricks'&&['ArrowLeft','ArrowRight','a','d'].includes(event.key)){event.preventDefault();s.keys[event.key==='ArrowLeft'||event.key==='a'?'left':'right']=true;return;}
    if([' ','Enter'].includes(event.key)&&['bricks','reaction','stop-ten','click'].includes(id)&&!event.target.closest('.vg-top,.vg-hud-side')){event.preventDefault();if(!event.repeat)dispatch('primary');}
  },{signal:events.signal});
  shell.addEventListener('keyup',event=>{if(id==='bricks'&&s.keys){if(['ArrowLeft','a'].includes(event.key))s.keys.left=false;if(['ArrowRight','d'].includes(event.key))s.keys.right=false;}},{signal:events.signal});
  function pauseHidden(){if(document.hidden||!focusActive()){model.pause();audio.stop();paint();}}
  document.addEventListener('visibilitychange',pauseHidden,{signal:events.signal});window.addEventListener('blur',()=>{model.pause();audio.stop();paint();},{signal:events.signal});
  const observer=new MutationObserver(pauseHidden);if(root.closest('.desktop-window'))observer.observe(root.closest('.desktop-window'),{attributes:true,attributeFilter:['hidden','class']});
  const renderText=()=>JSON.stringify({...s,coordinates:'Bricks: 504x504, top-left origin; x right, y down. Aim: target x/y in field percentages.',bricks:s.bricks?.filter(b=>b.alive),words:s.words?.slice(s.wordAt,s.wordAt+12),typed:undefined});
  const advance=ms=>{if(s.mode==='splash'){splash+=ms/1000;if(splash>=2.5)s.mode='menu';}else{const count=Math.ceil(ms/16.667);for(let i=0;i<count;i++)model.step(ms/1000/count);}last=performance.now();paint();};
  function setHooks(){window.render_game_to_text=renderText;window.advanceTime=advance;}
  shell.addEventListener('focusin',setHooks,{signal:events.signal});shell.addEventListener('pointerdown',setHooks,{signal:events.signal});setHooks();paint();audio.cue('launch');
  function loop(){if(!alive)return;tick();raf=requestAnimationFrame(loop);}raf=requestAnimationFrame(loop);
  return ()=>{alive=false;closeOnline?.();events.abort();observer.disconnect();cancelAnimationFrame(raf);audio.dispose();shell.remove();if(window.render_game_to_text===renderText){delete window.render_game_to_text;delete window.advanceTime;}};
}
