import {assetURL} from './config.js';
import {escape as escapeHTML} from './util.js';
import './open-games.css';
const slugs=["2048","air-hockey","ant-flap","ant-jump","balloon-pop","battleship","block-drop","bowling","breakout","bubble-shooter","checkers","connect-four","cross-road","dino-run","fruit-slice","gem-match","gomoku","hanoi","helicopter","helix-drop","hoop-shot","lights-out","mahjong-link","mancala","maze-muncher","memory-match","merge-drop","minesweeper","mini-golf","nonogram","paddle-duel","penalty-kick","piano-tap","pipe-connect","reversi","rush-hour","simon-says","slide-puzzle","slingshot","snake","snakes-ladders","sokoban","stack-tower","star-defender","sudoku","tic-tac-toe","water-sort","whack-a-mole","pong","wordle"];
const names=["2048","Air Hockey","Ant Flap","Ant Jump","Balloon Pop","Battleship","Block Drop","Bowling","Breakout","Bubble Shooter","Checkers","Connect Four","Cross Road","Dino Run","Fruit Slice","Gem Match","Gomoku","Hanoi","Helicopter","Helix Drop","Hoop Shot","Lights Out","Mahjong Link","Mancala","Maze Muncher","Memory Match","Merge Drop","Minesweeper","Mini Golf","Nonogram","Paddle Duel","Penalty Kick","Piano Tap","Pipe Connect","Reversi","Rush Hour","Simon Says","Slide Puzzle","Slingshot","Snake","Snakes Ladders","Sokoban","Stack Tower","Star Defender","Sudoku","Tic Tac Toe","Water Sort","Whack A Mole","Pong","Wordle"];
const symbols=["2","🏒","🐜","🦗","🎈","🚢","▦","🎳","▣","◉","⛀","●","🐸","🦕","🍉","💎","⚫","△","🚁","◐","🏀","💡","🀄","◕","●","▧","◉","💣","⛳","▦","🏓","⚽","♫","⌁","◕","🚗","◖","▦","➶","🐍","🎲","▣","▤","🚀","⑨","×","◉","●","◓","W"];
const puzzles=new Set(['2048','battleship','bubble-shooter','checkers','connect-four','gem-match','gomoku','hanoi','lights-out','mahjong-link','mancala','memory-match','merge-drop','minesweeper','nonogram','pipe-connect','reversi','rush-hour','slide-puzzle','sokoban','sudoku','tic-tac-toe','water-sort','wordle']);
export const OPEN_GAMES=slugs.map((slug,i)=>({id:'open-'+slug,slug,name:names[i],symbol:symbols[i],accent:['#8cc7f7','#ffc77a','#92dfc7','#dfb5ff','#fc9a9a','#ecce92'][i%6],ink:'#122031',category:'Games',tag:puzzles.has(slug)?'PUZZLE':'ARCADE',description:puzzles.has(slug)?'A complete strategy or puzzle game. Play directly in Vela.':'A complete arcade game with its own controls and scoring.',controls:'Use the mouse, keyboard or touch controls shown in the game. Scores are saved in your browser.',source:'open-source',note:'MIT-licensed game. Source and authors are credited inside the app.'}));
export const openGameDefinition=id=>OPEN_GAMES.find(game=>game.id===id);
export function mountOpenGame(root,{id}={}){
 const game=openGameDefinition(id);if(!game)throw Error('Unknown game');
 root.classList.add('vela-open-game-root');
 root.innerHTML='<div class="vela-open-game-shell"><div class="vela-open-game-bar"><span>'+escapeHTML(game.symbol)+' <strong>'+escapeHTML(game.name)+'</strong></span><div><a href="'+assetURL('open-games/SOURCES.md')+'" target="_blank" rel="noopener noreferrer">Credits and licenses</a><button type="button" data-reload-game aria-label="Restart game">Restart</button></div></div><div class="vela-open-game-frame-wrap"><div class="vela-open-loading" role="status">Opening '+escapeHTML(game.name)+'…</div><iframe title="'+escapeHTML(game.name)+'" allow="fullscreen; gamepad" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-downloads" loading="eager"></iframe></div></div>';
 const frame=root.querySelector('iframe'),loading=root.querySelector('.vela-open-loading');
 const src=assetURL('open-games/'+game.slug+'/index.html');
 frame.addEventListener('load',()=>{loading.hidden=true;});
 frame.src=src;
 root.querySelector('[data-reload-game]').onclick=()=>{loading.hidden=false;frame.src=src.split('#')[0]+'?restart='+Date.now();};
 return ()=>{frame.src='about:blank';root.replaceChildren();};
}
