import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {createArcadeState,arcadeAction,reversiMoves,stepSlither} from '../src/games/arcade-model.mjs';
import {botAction} from '../src/games/arcade-bots.mjs';
const start=game=>{const s=createArcadeState(game,['one','two']);for(const uid of s.players)arcadeAction(s,uid,{type:'ready'});return s};
let s=start('chess');const chessMove=(from,to,promotion)=>arcadeAction(s,s.turn,{type:'move',from,to,promotion,revision:s.revision});
assert.throws(()=>chessMove('e2','e5'));chessMove('f2','f3');chessMove('e7','e5');chessMove('g2','g4');chessMove('d8','h4');assert.equal(s.winner,'two');assert.equal(s.mode,'finished');
s=start('chess');s.fen='r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';chessMove('e1','g1');assert.equal(new Chess(s.fen).get('f1').type,'r');
s=start('chess');s.fen='7k/P7/8/8/8/8/8/7K w - - 0 1';chessMove('a7','a8','n');assert.equal(new Chess(s.fen).get('a8').type,'n');
s=start('chess');for(const [from,to] of [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5'],['e5','d6']])chessMove(from,to);assert.equal(new Chess(s.fen).get('d5'),undefined);
s=start('chess');const began=performance.now(),action=botAction(s,'one','hard');assert.ok(action);arcadeAction(s,'one',action);assert.ok(performance.now()-began<15000);console.log('PASS legal chess, checkmate, castling, underpromotion, en passant and hard bot.');
for(const game of ['tic-tac-toe','connect-four','reversi']){s=start(game);let moves=0;while(s.mode==='playing'&&moves++<70){const uid=s.turn,action=botAction(s,uid,'normal');assert.ok(action);arcadeAction(s,uid,action)}assert.equal(s.mode,'finished',game);assert.ok(s.winner);if(game==='reversi')assert.ok(s.board.filter(Boolean).length>50);console.log('PASS complete '+game+' computer match.');}
s=start('tic-tac-toe');arcadeAction(s,'one',{type:'move',cell:0,revision:s.revision});arcadeAction(s,'two',{type:'move',cell:3,revision:s.revision});arcadeAction(s,'one',{type:'move',cell:1,revision:s.revision});assert.equal(botAction(s,'two','hard').cell,2);
s=start('reversi');assert.deepEqual(reversiMoves(s.board,'X'),[19,26,37,44]);assert.throws(()=>arcadeAction(s,'one',{type:'move',cell:0,revision:s.revision}));
for(let n=0;n<30;n++){s=start('slither');assert.equal(s.snakes.length,10);for(let i=0;i<10;i++)stepSlither(s,.05);assert.equal(s.mode,'playing','Safe spawn must not instantly end a match');assert.ok(s.snakes.some(p=>p.bot&&p.alive));}console.log('PASS Slither safe starts, arena bots and expanded arena.');
console.log('PASS game upgrade model and bot checks.');
