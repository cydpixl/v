export const GAMES = [
  {id:'slither',name:'Slither',accent:'#81edc4',ink:'#15382e',symbol:'〰',tag:'GROW. BOOST. OUTPLAY.',description:'A live snake arena for you and a friend. Collect light, cut them off, and stay alive.',controls:'Steer with your pointer or arrow keys. Hold Space or press to boost. Avoid the walls and the other snake. Highest score after two minutes wins.',unit:'pts',multiplayer:true},
  {id:'rock-paper-scissors',name:'Rock Paper Scissors',accent:'#ffb594',ink:'#462b24',symbol:'✌',tag:'TRUST YOUR INSTINCT',description:'Lock in your choice. Read your friend. First to three wins.',controls:'Pick rock, paper, or scissors. Choices stay hidden until both players lock in. Ready up between rounds.',unit:'wins',multiplayer:true},
  {id:'connect-four',name:'Connect Four',accent:'#8ac4ff',ink:'#20364d',symbol:'●',tag:'ONE MOVE AHEAD',description:'Drop a disc. Build a threat. Connect four against a friend online.',controls:'Choose a column to drop a disc. Connect four in any direction. Take turns and play a rematch.',unit:'wins',multiplayer:true},
  {id:'bricks',name:'Bricks vs Balls',accent:'#ffb86b',ink:'#48270f',symbol:'▰',tag:'BREAK THROUGH',description:'A paddle, a ball, and a wall of bricks.',controls:'Move with your mouse, touch, or ← →. Space launches. Clear three boards; keep your three lives.',unit:'pts'},
  {id:'tic-tac-toe',name:'Tic Tac Toe',accent:'#b6adff',ink:'#30274f',symbol:'×',tag:'YOUR NEXT MOVE',description:'Three in a row. Play the computer or a friend.',controls:'Choose a square. Connect three horizontally, vertically, or diagonally. X goes first.',unit:'wins'},
  {id:'reaction',name:'Reaction Race',accent:'#b4f379',ink:'#243c18',symbol:'ϟ',tag:'TRUST YOUR REFLEXES',description:'Wait for green. Make your move.',controls:'Click, tap, or press Space when green appears. Five rounds. Your fastest reaction wins.',unit:'ms',lower:true},
  {id:'aim',name:'Aim Rush',accent:'#ff8da7',ink:'#4f2030',symbol:'◎',tag:'MAKE EVERY HIT COUNT',description:'Thirty seconds. Ten points per target.',controls:'Click or tap the targets. Each hit earns 10 points. You have 30 seconds.',unit:'pts'},
  {id:'stop-ten',name:'Stop at 10',accent:'#81dce8',ink:'#173d42',symbol:'10',tag:'FIND THE MOMENT',description:'How close can you get to 10.00 seconds?',controls:'Click, tap, or press Space to stop the clock. The smallest distance from 10.00 seconds wins.',unit:'s off',lower:true},
  {id:'type',name:'Type Sprint',accent:'#f6d47e',ink:'#493b16',symbol:'Aa',tag:'FIND YOUR FLOW',description:'Random words. Thirty seconds. Your pace.',controls:'Type each word and press Space or Enter. Backspace fixes your current word. Speed and accuracy both count.',unit:'WPM'},
  {id:'memory',name:'Memory Grid',accent:'#8de0c2',ink:'#193e30',symbol:'▦',tag:'KEEP IT IN MIND',description:'Remember the light. Repeat the pattern.',controls:'Memorize the highlighted squares, then select them in any order. Complete a level for 100 points. One wrong square ends the run.',unit:'pts'},
  {id:'click',name:'Click Frenzy',accent:'#ffae92',ink:'#4c291d',symbol:'↗',tag:'TEN SECONDS. ALL IN.',description:'One button. Ten seconds. Every click counts.',controls:'Click or tap as fast as you can for 10 seconds. Space and Enter also work; holding a key does not count.',unit:'clicks'}
];
export const gameDefinition = id => GAMES.find(game => game.id === id);
const art = {
 slither:'<path d="M10 36h19a9 9 0 0 0 0-18H19a6 6 0 0 1 0-12h18" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><circle cx="37" cy="5" r="1.4" fill="#173a30"/>',
 'rock-paper-scissors':'<path d="M17 36l-5-12c-2-5 4-6 7 1V10c0-4 6-4 6 0v12l4-16c1-4 7-2 6 2l-4 19c9-9 13-4 7 3l-8 10H20z"/>',
 'connect-four':Array.from({length:16},(_,i)=>`<circle cx="${9+i%4*10}" cy="${9+Math.floor(i/4)*10}" r="4" opacity="${[0,5,10,15].includes(i)?1:.3}"/>`).join(''),
 bricks:'<rect x="10" y="11" width="12" height="6" rx="2"/><rect x="25" y="11" width="13" height="6" rx="2"/><rect x="10" y="20" width="18" height="6" rx="2"/><circle cx="33" cy="30" r="4"/><rect x="13" y="38" width="23" height="4" rx="2"/>',
 'tic-tac-toe':'<path d="M11 11l12 12m0-12L11 23" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="33" cy="33" r="8" fill="none" stroke="currentColor" stroke-width="4"/>',
 reaction:'<path d="M27 5L12 27h12l-3 16 16-24H25z"/>',
 aim:'<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="24" r="3"/>',
 'stop-ten':'<text x="24" y="32" text-anchor="middle" font-size="25" font-family="system-ui" font-weight="700">10</text>',
 type:'<text x="24" y="32" text-anchor="middle" font-size="25" font-family="system-ui" font-weight="650">Aa</text>',
 memory:Array.from({length:9},(_,i)=>`<rect x="${9+i%3*11}" y="${9+Math.floor(i/3)*11}" width="8" height="8" rx="2" opacity="${[0,2,4,7].includes(i)?1:.25}"/>`).join(''),
 click:'<path d="M13 9l5 29 7-10 12-4z"/><path d="M31 7v5m9 5h-5m2-9l-5 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
};
export const gameIcon = id => `<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">${art[id]||''}</svg>`;
