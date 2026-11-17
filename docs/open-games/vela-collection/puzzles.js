const rand=(n)=>Math.floor(Math.random()*n);
const shuffle=(a)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const el=(tag,cls='',value='')=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;};
function board(ctx,title,subtitle){const root=el('div','board');ctx.area.replaceChildren(root);root.append(el('h2','',title),el('p','',subtitle));return root;}
const add=(parent,...items)=>{parent.append(...items);return items[items.length-1];};
const btn=(label,fn,cls='subtle')=>{const b=el('button',cls,label);b.type='button';b.onclick=fn;return b;};
function answer(root,fn,placeholder='Your answer',type='text'){
 const form=el('form','answer'),input=el('input');input.type=type;input.autocomplete='off';input.spellcheck=false;input.placeholder=placeholder;input.setAttribute('aria-label',placeholder);
 const submit=el('button','','Submit');submit.type='submit';form.append(input,submit);root.append(form);form.addEventListener('submit',ev=>{ev.preventDefault();const v=input.value.trim();if(v)fn(v,input);});input.focus();return input;
}
const info=(root)=>add(root,el('div','message',''));
function grid(root,size,cls=''){const g=el('div','grid '+cls);g.style.gridTemplateColumns='repeat('+size+',1fr)';root.append(g);return g;}

export function puzzleGame(id,ctx){
 if(id==='word-search'){
  const words=['PLANET','COMET','ORBIT','NEBULA','ASTRO'];const chars=Array.from({length:64},()=>String.fromCharCode(65+rand(26)));
  const rows=shuffle([0,2,3,5,7]);const chosen=words.map((w,i)=>{const row=rows[i],reverse=rand(2)===1,first=reverse?7:0;for(let j=0;j<w.length;j++)chars[row*8+first+(reverse?-j:j)]=w[j];return {word:w,row,first,last:first+(reverse?-(w.length-1):(w.length-1))};});
  const root=board(ctx,'Find the hidden words','Select the first and last letter. Words are horizontal, in either direction.');
  const all=el('div','pills');words.forEach(w=>all.append(el('span','pill',w)));root.append(all);
  const g=grid(root,8,'word-grid');const found=new Set(),selected=new Set();let first=null;
  const cells=chars.map((ch,i)=>{const b=btn(ch,()=>pick(i),'grid-cell');b.setAttribute('aria-label','Row '+(Math.floor(i/8)+1)+' column '+(i%8+1)+' '+ch);g.append(b);return b;});
  const msg=info(root);
  function pick(i){if(found.size===words.length)return;if(first===null){first=i;cells[i].classList.add('selected');msg.textContent='Select the end of the word.';return;}
   const end=i;const match=chosen.find(o=>(o.row*8+o.first===first&&o.row*8+o.last===end)||(o.row*8+o.last===first&&o.row*8+o.first===end));
   if(match&&!found.has(match.word)){found.add(match.word);const step=match.last>=match.first?1:-1;for(let x=match.first;;x+=step){cells[match.row*8+x].classList.add('found');if(x===match.last)break;}[...all.children].find(b=>b.textContent===match.word).classList.add('complete');ctx.add(20);msg.textContent=match.word+' found!';if(found.size===5)ctx.end('All words found');}
   else msg.textContent='Try another pair of letters.';
   cells.forEach(c=>c.classList.remove('selected'));first=null;
  }
  return {};
 }
 if(id==='word-scramble'){
  const words=shuffle(['RIDDLE','PLANET','ORANGE','CASTLE','MARBLE','FOREST','GALAXY','PUZZLE','GUITAR','SHADOW','OCEANS','ROCKET','VELVET','CANDLE']).slice(0,8);let i=0;
  const root=board(ctx,'Unscramble','Eight words · 90 seconds');
  const current=el('h2','',''),sub=el('p','',''),msg=info(root);root.append(current,sub);
  const input=answer(root,(value,field)=>{if(value.toUpperCase()===words[i]){ctx.add(10);i++;msg.textContent='Correct!';if(i===words.length)ctx.end('All eight solved');else{field.value='';next();}}else msg.textContent='Not quite. Try again.';},'Unscrambled word');
  let scramble='';
  function next(){do{scramble=shuffle(words[i].split('')).join('');}while(scramble===words[i]);current.textContent=scramble;sub.textContent='Word '+(i+1)+' of '+words.length;}next();
  return {tick(){if(ctx.elapsed>=90)ctx.end('Time is up');}};
 }
 if(id==='code-breaker'){
  const secret=shuffle([1,2,3,4,5,6]).slice(0,4);let tries=0;const root=board(ctx,'Crack the code','Four different digits, each from 1–6. You have eight attempts.');const log=el('div','pills');root.append(log);const msg=info(root);
  const input=answer(root,(v,f)=>{if(!/^[1-6]{4}$/.test(v)||new Set(v).size!==4){msg.textContent='Use four different digits from 1 to 6.';return;}
    tries++;const guess=v.split('').map(Number),exact=guess.filter((x,i)=>x===secret[i]).length,misplaced=guess.filter(x=>secret.includes(x)).length-exact;
    log.append(el('span','pill',v+' · '+exact+' exact · '+misplaced+' misplaced'));f.value='';ctx.add(exact*5+misplaced);
    if(exact===4){ctx.add((9-tries)*10);ctx.end('Code cracked!');}else if(tries>=8){ctx.end('Code was '+secret.join(''));}else msg.textContent=(8-tries)+' guesses remaining.';
  },'Four digits (e.g. 1234)','text');input.maxLength=4;input.inputMode='numeric';return {};
 }
 if(id==='math-rush'){
  let correct=0,question,expected;const root=board(ctx,'Math Rush','Solve as many as you can in 60 seconds.');const q=el('h2','','');root.append(q);const msg=info(root);
  const next=()=>{const a=rand(18)+3,b=rand(12)+2,op=rand(3);question=op===0?a+' + '+b:op===1?(a+b)+' − '+b:a+' × '+b;expected=op===0?a+b:op===1?a:a*b;q.textContent=question+' = ?';};
  const input=answer(root,(v,f)=>{if(Number(v)===expected){correct++;ctx.add(5);msg.textContent='Correct · '+correct+' solved';}else msg.textContent='Answer: '+expected;f.value='';next();},'Answer','number');input.inputMode='numeric';next();return {tick(){if(ctx.elapsed>=60)ctx.end('Math round complete');}};
 }
 if(id==='higher-lower'){
  const secret=rand(99)+1;let tries=0,previous=[];const root=board(ctx,'Guess the number','A secret number from 1 to 99. Seven attempts.');const msg=info(root),history=el('div','pills');root.append(history);
  const field=answer(root,(v,f)=>{const num=Number(v);if(!Number.isInteger(num)||num<1||num>99){msg.textContent='Choose a whole number from 1 to 99.';return;}
   tries++;previous.push(num);history.append(el('span','pill',String(num)));f.value='';
   if(num===secret){ctx.add(80-tries*10);ctx.end('You found it!');return;}
   if(tries===7){ctx.end('The number was '+secret);return;}
   msg.textContent=(num<secret?'Higher':'Lower')+' · '+(7-tries)+' guesses left.';
  },'1–99','number');field.min='1';field.max='99';return {};
 }
 if(id==='sequence-sprint'){
  let solved=0,expected;const root=board(ctx,'Sequence Sprint','Complete ten number patterns.');const q=el('h2','','');root.append(q);const msg=info(root);
  const next=()=>{const mode=rand(4),start=rand(10)+1,d=rand(6)+2;let arr;
   if(mode===0)arr=Array.from({length:5},(_,i)=>start+d*i);
   else if(mode===1)arr=Array.from({length:5},(_,i)=>start*(i+1));
   else if(mode===2)arr=Array.from({length:5},(_,i)=>start+i*i);
   else arr=Array.from({length:5},(_,i)=>start+Math.pow(2,i));
   expected=arr[4];q.textContent=arr.slice(0,4).join(' · ')+' · ?';};
  const input=answer(root,(v,f)=>{if(Number(v)===expected){ctx.add(10);msg.textContent='Correct!';solved++;if(solved>=10){ctx.end('All sequences solved');return;}}else msg.textContent='The answer was '+expected+'.';f.value='';next();},'Next number','number');input.inputMode='numeric';next();
  return {tick(){if(ctx.elapsed>=90)ctx.end('Time is up');}};
 }
 if(id==='maze-path'){
  let maze;const N=7,dirs=[[1,0],[-1,0],[0,1],[0,-1]];const idx=(r,c)=>r*N+c;
  function connected(a){const seen=new Set([0]),queue=[0];while(queue.length){const p=queue.shift(),r=Math.floor(p/N),c=p%N;for(const [dr,dc] of dirs){const nr=r+dr,nc=c+dc,k=idx(nr,nc);if(nr>=0&&nr<N&&nc>=0&&nc<N&&!seen.has(k)&&!a[k]){seen.add(k);queue.push(k);}}}return seen.has(48);}
  do{maze=Array.from({length:49},(_,i)=>i!==0&&i!==48&&Math.random()<.25);}while(!connected(maze));
  const root=board(ctx,'Maze Path','Travel from the blue tile to the green exit.');const g=grid(root,N);g.style.width='min(100%,420px)';let path=[0];const msg=info(root);
  const cells=Array.from({length:49},(_,i)=>{const b=btn(i===0?'S':i===48?'E':'',()=>go(i),'grid-cell');b.setAttribute('aria-label','Maze row '+(Math.floor(i/N)+1)+', column '+(i%N+1));g.append(b);return b;});
  const back=btn('Back one step',()=>{if(path.length>1){path.pop();draw();}},'subtle');root.append(back);
  function draw(){cells.forEach((b,i)=>{b.className='grid-cell'+(maze[i]?' bad':'')+(path.includes(i)?' selected':'')+(path.at(-1)===i?' current':'');b.disabled=maze[i];});msg.textContent='Steps: '+(path.length-1);}
  function go(i){if(maze[i])return;const pos=path.at(-1),pr=Math.floor(pos/N),pc=pos%N,r=Math.floor(i/N),c=i%N;
   if(path.at(-2)===i){path.pop();draw();return;}
   if(Math.abs(pr-r)+Math.abs(pc-c)!==1)return;path.push(i);draw();if(i===48){ctx.add(Math.max(10,150-path.length*2));ctx.end('Maze escaped');}}
  draw();return {};
 }
 if(id==='peg-solitaire'){
  const valid=(r,c)=>r>=0&&r<7&&c>=0&&c<7&&(r>=2&&r<=4||c>=2&&c<=4);let boardState=Array.from({length:49},(_,i)=>valid(Math.floor(i/7),i%7)&&i!==24);
  const root=board(ctx,'Peg Solitaire','Jump over a peg into an empty hole to remove it.');const g=grid(root,7,'peg-grid');const msg=info(root);let chosen=null;
  const cells=Array.from({length:49},(_,i)=>{const b=btn('',()=>move(i),'grid-cell');g.append(b);return b;});
  const legal=(a,b)=>{const ar=Math.floor(a/7),ac=a%7,br=Math.floor(b/7),bc=b%7;const dist=Math.abs(ar-br)+Math.abs(ac-bc);
   if(dist!==2||(ar!==br&&ac!==bc)||!valid(br,bc)||!boardState[a]||boardState[b])return false;const mid=((ar+br)/2)*7+(ac+bc)/2;return boardState[mid];};
  const moves=()=>boardState.some((on,i)=>on&&boardState.some((_,j)=>legal(i,j)));
  function draw(){cells.forEach((b,i)=>{const good=valid(Math.floor(i/7),i%7);b.disabled=!good;b.className='grid-cell '+(!good?'empty':boardState[i]?'':'hole')+(chosen===i?' selected':'');b.textContent=good?(boardState[i]?'●':'·'):'';});msg.textContent=boardState.filter(Boolean).length+' pegs remaining';}
  function move(i){if(chosen!==null&&legal(chosen,i)){const ar=Math.floor(chosen/7),ac=chosen%7,br=Math.floor(i/7),bc=i%7,mid=((ar+br)/2)*7+(ac+bc)/2;boardState[chosen]=false;boardState[mid]=false;boardState[i]=true;chosen=null;ctx.add(2);draw();
   if(boardState.filter(Boolean).length===1)ctx.end('Perfect finish!');else if(!moves())ctx.end('No moves left');return;}
   chosen=boardState[i]?i:null;draw();}
  draw();return {};
 }
 if(id==='flood-grid'){
  const N=8,C=5,colors=['#83d8fa','#f0b28b','#a78bec','#8bd4a4','#f3dc8b'];const tiles=Array.from({length:N*N},()=>rand(C));let turns=0;
  const root=board(ctx,'Flood Grid','Fill every tile with one color in 22 moves or less.');const g=grid(root,N,'flood-grid');const msg=info(root);
  const cells=tiles.map((t,i)=>{const b=el('div','grid-cell');g.append(b);return b;});
  const controls=el('div','rainbow');root.append(controls);
  const flood=(from,to)=>{if(from===to)return;const visited=new Set(),stack=[0];while(stack.length){const i=stack.pop();if(visited.has(i)||tiles[i]!==from)continue;visited.add(i);const r=Math.floor(i/N),c=i%N;if(r>0)stack.push(i-N);if(r<N-1)stack.push(i+N);if(c>0)stack.push(i-1);if(c<N-1)stack.push(i+1);}for(const i of visited)tiles[i]=to;};
  function draw(){cells.forEach((b,i)=>b.style.background=colors[tiles[i]]);msg.textContent=(22-turns)+' moves remaining';}
  for(let color=0;color<C;color++){const b=btn('',()=>{if(color===tiles[0])return;flood(tiles[0],color);turns++;ctx.add(1);draw();if(tiles.every(v=>v===color)){ctx.add(Math.max(0,22-turns)*3);ctx.end('Grid filled!');}else if(turns>=22)ctx.end('Out of moves');},'');b.style.background=colors[color];b.setAttribute('aria-label','Flood with color '+(color+1));controls.append(b);}
  draw();return {};
 }
 if(id==='seven-queens'){
  const N=7,queens=new Set(),root=board(ctx,'Seven Queens','Place seven queens with no matching row, column or diagonal.');const g=grid(root,N);g.style.width='min(100%,410px)';const msg=info(root);
  const cells=Array.from({length:49},(_,i)=>{const b=btn('',()=>{if(queens.has(i))queens.delete(i);else queens.add(i);draw();},'grid-cell');g.append(b);return b;});
  function conflict(i,j){const a=Math.floor(i/N),b=i%N,c=Math.floor(j/N),d=j%N;return a===c||b===d||Math.abs(a-c)===Math.abs(b-d);}
  function draw(){const entries=[...queens];const danger=new Set(entries.filter(i=>entries.some(j=>i!==j&&conflict(i,j))));cells.forEach((b,i)=>{b.textContent=queens.has(i)?'♛':'';b.className='grid-cell'+(danger.has(i)?' bad':queens.has(i)?' selected':'');});msg.textContent=queens.size+' / 7 queens'+(danger.size?' · '+danger.size+' in conflict':'');if(queens.size===7&&!danger.size){ctx.add(100);ctx.end('Seven queens placed!');}}
  draw();return {};
 }
 if(id==='domino-chain'){
  const values=Array.from({length:15},()=>rand(7)),pairs=shuffle(Array.from({length:14},(_,i)=>[values[i],values[i+1]]));let ends=[values[0],values[0]],moves=0;
  const root=board(ctx,'Domino Chain','Add matching tiles to either open end.');const chain=el('div','domino-chain'),hand=el('div','domino-hand'),msg=info(root);root.append(chain,hand);
  const tile=(a,b)=>{const d=el('button','domino');d.type='button';add(d,el('span','',String(a)),el('span','',String(b)));return d;};
  function draw(){chain.replaceChildren(el('span','pill','LEFT '+ends[0]),el('span','pill','RIGHT '+ends[1]));hand.replaceChildren();
   pairs.forEach((p,i)=>{const b=tile(...p),match=p.includes(ends[0])||p.includes(ends[1]);b.disabled=!match;b.setAttribute('aria-label','Domino '+p[0]+' and '+p[1]);b.onclick=()=>{
     const [a,c]=p;
     if(a===ends[1])ends[1]=c;else if(c===ends[1])ends[1]=a;else if(c===ends[0])ends[0]=a;else if(a===ends[0])ends[0]=c;
     pairs.splice(i,1);moves++;ctx.add(5);draw();
    };hand.append(b);});msg.textContent=pairs.length+' tiles remaining · '+moves+' placed';
   if(!pairs.length)ctx.end('All dominoes played!');else if(!pairs.some(p=>p.includes(ends[0])||p.includes(ends[1])))ctx.end('No playable dominoes');}
  draw();return {};
 }
 if(id==='dots-boxes'){
  const N=4,edges=[];for(let r=0;r<N;r++)for(let c=0;c<N-1;c++)edges.push({r,c,h:true,owner:0});
  for(let r=0;r<N-1;r++)for(let c=0;c<N;c++)edges.push({r,c,h:false,owner:0});
  const boxes=Array(9).fill(0);let bot=0,human=0;
  const root=board(ctx,'Dots & Boxes','Complete more boxes than the computer. A captured box earns another turn.');const field=el('div','dots-board'),msg=info(root);root.append(field);
  const pos=x=>12+x*25.3;
  const boxEdges=(r,c)=>edges.map((e,i)=>({e,i})).filter(({e})=>(e.h&&(e.r===r||e.r===r+1)&&e.c===c)||(!e.h&&(e.c===c||e.c===c+1)&&e.r===r)).map(x=>x.i);
  const relatives=Array.from({length:9},(_,i)=>boxEdges(Math.floor(i/3),i%3));
  const edgeNodes=edges.map((edge,i)=>{const b=btn('',()=>turn(i),'edge');b.setAttribute('aria-label','Line '+(i+1));field.append(b);return b;});
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){const d=el('span','dot');d.style.left=pos(c)+'%';d.style.top=pos(r)+'%';field.append(d);}
  const markers=boxes.map((_,i)=>{const d=el('div','box-own');d.style.left=pos(i%3)+12.65+'%';d.style.top=pos(Math.floor(i/3))+12.65+'%';d.style.width='22%';d.style.height='22%';field.append(d);return d;});
  function mark(i,who){edges[i].owner=who;let taken=0;relatives.forEach((arr,b)=>{if(!boxes[b]&&arr.every(j=>edges[j].owner)){boxes[b]=who;taken++;if(who===1){human++;ctx.add(10);}else bot++;}});return taken;}
  function draw(){edges.forEach((e,i)=>{const b=edgeNodes[i];b.className='edge'+(e.owner?' claimed':'');b.disabled=!!e.owner;b.style.left=(pos(e.c)-(e.h?0:1))+'%';b.style.top=(pos(e.r)-(e.h?1:0))+'%';b.style.width=(e.h?'25.3%':'3%');b.style.height=(e.h?'3%':'25.3%');});markers.forEach((m,i)=>{m.style.background=boxes[i]===1?'#3ba2ce55':boxes[i]===2?'#e79b8b55':'transparent';});msg.textContent='You '+human+'  ·  Computer '+bot;}
  function turn(i){if(edges[i].owner)return;const cap=mark(i,1);if(!cap){const available=edges.map((e,j)=>!e.owner?j:-1).filter(j=>j!==-1);if(available.length){let best=available.filter(j=>relatives.some(arr=>arr.includes(j)&&arr.filter(k=>edges[k].owner).length===3));while(true){const pick=best.length?best[rand(best.length)]:available[rand(available.length)];const count=mark(pick,2);const other=edges.map((e,j)=>!e.owner?j:-1).filter(j=>j>=0);if(!count||!other.length)break;available.length=0;available.push(...other);best=available.filter(j=>relatives.some(arr=>arr.includes(j)&&arr.filter(k=>edges[k].owner).length===3));}}}
   draw();if(edges.every(e=>e.owner))ctx.end(human>bot?'You won!':human===bot?'A draw':'Computer wins');}
  draw();return {};
 }
 if(id==='tri-peaks'){
  const full=shuffle(Array.from({length:52},(_,i)=>({rank:i%13+1,suit:Math.floor(i/13)})));const tableau=full.slice(0,28).map((c,i)=>({...c,index:i,removed:false}));let stock=full.slice(28),waste=stock.pop(),cleared=0;
  const rowStarts=[0,3,9,18],lengths=[3,6,9,10];
  const child=[...Array.from({length:3},(_,i)=>[3+i*2,4+i*2]),...Array.from({length:6},(_,i)=>[9+Math.floor(i/2)*3+(i%2),10+Math.floor(i/2)*3+(i%2)]),...Array.from({length:9},(_,i)=>[18+i,19+i])];
  const root=board(ctx,'Tri Peaks','Remove an exposed card one rank above or below the waste.');const rows=el('div',''),msg=info(root);root.append(rows);const deck=el('div','deck');root.append(deck);
  const face=c=>({v:'A23456789TJQK'[c.rank-1],s:'♠♥♣♦'[c.suit]});
  const available=i=>!tableau[i].removed&&(i>=18||child[i].every(j=>tableau[j].removed));
  const matches=(a,b)=>Math.abs(a-b)===1||Math.abs(a-b)===12;
  function draw(){rows.replaceChildren();for(let r=0;r<4;r++){const strip=el('div','cards');strip.style.marginBottom=r===0?'-11px':'-10px';
   for(let j=0;j<lengths[r];j++){const i=rowStarts[r]+j,c=tableau[i],ready=available(i),b=btn('',()=>play(i),'card-playing'+(c.suit%2?' red':'')+(!ready?' back':''));
    b.textContent=c.removed?'':ready?face(c).v+face(c).s:'◆';b.disabled=c.removed||!ready||!matches(c.rank,waste.rank);b.style.visibility=c.removed?'hidden':'visible';strip.append(b);}rows.append(strip);}
   deck.replaceChildren(btn('Draw ('+stock.length+')',()=>{if(stock.length){waste=stock.pop();draw();}else ctx.hint('Stock empty · Try another deal');},'subtle'),el('span','pill','Waste '+face(waste).v+face(waste).s));
   msg.textContent=cleared+' of 28 cards cleared';
   if(cleared===28)ctx.end('Three peaks cleared!');else if(stock.length===0&&!tableau.some((c,i)=>available(i)&&matches(c.rank,waste.rank)))ctx.end('No more moves');}
  function play(i){if(!available(i)||!matches(tableau[i].rank,waste.rank))return;waste=tableau[i];tableau[i].removed=true;cleared++;ctx.add(5);draw();}
  draw();return {};
 }
 if(id==='number-trail'){
  const nums=shuffle(Array.from({length:25},(_,i)=>i+1));let next=1;
  const root=board(ctx,'Number Trail','Tap the numbers in ascending order. Fast, clean runs win.');const g=grid(root,5);g.style.width='min(100%,430px)';const msg=info(root);
  nums.forEach(num=>{const b=btn(String(num),()=>{if(num!==next){msg.textContent='Find '+next;return;}b.disabled=true;b.classList.add('found');ctx.add(4);next++;msg.textContent='Find '+next;if(next===26){ctx.add(Math.max(0,200-Math.floor(ctx.elapsed*3)));ctx.end('Trail complete!');}},'grid-cell');b.setAttribute('aria-label','Number '+num);g.append(b);});msg.textContent='Find 1';return {};
 }
 return null;
}
