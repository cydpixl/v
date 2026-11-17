import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const root='public/open-games/vela-collection/';
const names=['meteor-dodge','sky-glider','neon-runner','lane-drift','color-catcher','moving-targets','pulse-guard','gravity-swap','orbit-escape','laser-gates','word-search','word-scramble','code-breaker','math-rush','higher-lower','sequence-sprint','maze-path','peg-solitaire','flood-grid','seven-queens','domino-chain','dots-boxes','tri-peaks','number-trail'];
for(const path of ['engine.js','arcade.js','puzzles.js']){const check=spawnSync(process.execPath,['--check',root+path],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);}
const open=fs.readFileSync('src/open-games.mjs','utf8'),html=fs.readFileSync(root+'index.html','utf8'),css=fs.readFileSync(root+'style.css','utf8');
assert.match(open,/concat\(VELA_COLLECTION\)/);
assert.match(open,/game\.collection/);assert.match(html,/engine\.js/);assert.match(css,/prefers-reduced-motion/);
for(const slug of names){assert.ok(open.includes('"slug": "'+slug+'"'),slug+' missing from catalog');assert.ok(fs.readFileSync(root+'engine.js','utf8').includes("'"+slug+"'"),slug+' missing from runtime');}
const ctx2d=new Proxy({}, {get:(_,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
function make(tag){return {tagName:tag,children:[],style:{},className:'',textContent:'',disabled:false,events:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(type,fn){(this.events[type]??=[]).push(fn);},focus(){},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},getContext(){return ctx2d;},getBoundingClientRect(){return {left:0,top:0,width:720,height:440}}};}
const source=['arcade.js','puzzles.js'].map(file=>fs.readFileSync(root+file,'utf8').replaceAll('export ','')).join('\n');
const module=new Function('document','window',source+'; return {arcadeGame,puzzleGame};')({createElement:make},make('window'));
let passed=0;
for(const slug of names){const area=make('main');const session={area,score:0,elapsed:0,on(t,type,fn){t.addEventListener(type,fn);},add(value=1){this.score+=value;},set(value){this.score=value;},end(){},hint(){}};const game=module.arcadeGame(slug,session)||module.puzzleGame(slug,session);assert.ok(game,'No implementation for '+slug);for(let i=0;i<10;i++){game.tick?.(.016);session.elapsed+=.016;}assert.ok(area.children.length>0,'Empty game screen: '+slug);passed++;}
console.log('PASS '+passed+' games: catalog registration, syntax, initial render, animations/ticks, and nonempty interactive screen.');
