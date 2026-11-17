const W=720,H=440,TAU=Math.PI*2;
const random=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function circle(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
function rect(g,x,y,w,h,color,r=0){g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,Math.max(0,r));g.fill();}
function text(g,s,x,y,size=18,color='#e8f4ff',align='left'){g.fillStyle=color;g.font='700 '+size+'px system-ui';g.textAlign=align;g.fillText(s,x,y);}
function hitBox(x,y,w,h,a,b,r){return a+r>x&&a-r<x+w&&b+r>y&&b-r<y+h;}
const palette=['#79d8fc','#f7c77f','#f39ba6','#8de1b9','#c8a3ee'];

export function arcadeGame(id,ctx){
 const modes=['meteor-dodge','sky-glider','neon-runner','lane-drift','color-catcher','moving-targets','pulse-guard','gravity-swap','orbit-escape','laser-gates'];
 if(!modes.includes(id))return null;
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.setAttribute('aria-label','Animated '+id.replaceAll('-',' ')+' game');ctx.area.append(canvas);
 const g=canvas.getContext('2d');if(!g)throw Error('Canvas is unavailable');
 const keys=new Set();const objects=[];let t=0,spawn=0,x=360,y=350,v=0,lives=3,level=1,phase=0,target=0,shots=0,angle=-Math.PI/2,dir=1,cool=0;
 let scoreTimer=0, passed=0, lane=1, collected=0, glowing=0;
 const pos=(ev)=>{const b=canvas.getBoundingClientRect();return {x:(ev.clientX-b.left)*W/b.width,y:(ev.clientY-b.top)*H/b.height};};
 function popTarget(){return {x:random(70,650),y:random(75,330),r:random(18,28),vx:random(-150,150)||90,vy:random(-105,105)||70,hue:palette[Math.floor(random(0,5))]};}
 if(id==='moving-targets'){for(let i=0;i<5;i++)objects.push(popTarget());ctx.hint('30 seconds · Each hit earns 10');}
 if(id==='color-catcher')ctx.hint('Catch '+['BLUE','AMBER','PINK'][target]+' · Three mistakes allowed');
 if(id==='pulse-guard')ctx.hint('Pulse when incoming drones enter the inner ring');
 if(id==='orbit-escape')ctx.hint('Survive 35 seconds');
 if(id==='sky-glider')y=205;
 if(id==='gravity-swap')lane=0;
 function action(){
  if(id==='sky-glider')v=-270;
  if(id==='neon-runner'&&y>=350)v=-515;
  if(id==='pulse-guard'&&cool<=0){
   cool=.78;glowing=.3;
   for(let i=objects.length-1;i>=0;i--){const o=objects[i],d=Math.hypot(o.x-360,o.y-220);if(d<=150&&d>=32){objects.splice(i,1);ctx.add(5);}}
  }
  if(id==='gravity-swap')lane=1-lane;
  if(id==='orbit-escape')dir*=-1;
 }
 ctx.on(window,'keydown',ev=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','a','d','A','D'].includes(ev.key))ev.preventDefault();
  keys.add(ev.key.toLowerCase());
  if([' ','arrowup'].includes(ev.key.toLowerCase())&&!ev.repeat)action();
  if(id==='lane-drift'&&!ev.repeat){if(['arrowleft','a'].includes(ev.key.toLowerCase()))lane=Math.max(0,lane-1);if(['arrowright','d'].includes(ev.key.toLowerCase()))lane=Math.min(2,lane+1);}
 });
 ctx.on(window,'keyup',ev=>keys.delete(ev.key.toLowerCase()));
 ctx.on(window,'blur',()=>keys.clear());
 ctx.on(canvas,'pointerdown',ev=>{
  const p=pos(ev);if(id==='moving-targets'){for(let i=objects.length-1;i>=0;i--){const o=objects[i];if(Math.hypot(o.x-p.x,o.y-p.y)<o.r+10){ctx.add(10);objects[i]=popTarget();glowing=.1;return;}}return;}
  if(id==='lane-drift'){lane=clamp(Math.floor(p.x/(W/3)),0,2);return;}
  if(['meteor-dodge','color-catcher','laser-gates'].includes(id)){x=p.x;return;}
  action();
 });
 ctx.on(canvas,'pointermove',ev=>{if(ev.buttons&&['meteor-dodge','color-catcher','laser-gates'].includes(id))x=pos(ev).x;});
 function bg(){
  const gradient=g.createLinearGradient(0,0,W,H);gradient.addColorStop(0,'#0c1c31');gradient.addColorStop(1,'#101626');g.fillStyle=gradient;g.fillRect(0,0,W,H);
  g.strokeStyle='#c3e5ff0d';g.lineWidth=1;for(let xx=0;xx<=W;xx+=40){g.beginPath();g.moveTo(xx,0);g.lineTo(xx,H);g.stroke();}
  for(let yy=0;yy<=H;yy+=40){g.beginPath();g.moveTo(0,yy);g.lineTo(W,yy);g.stroke();}
  for(let i=0;i<36;i++){const sx=(i*173+23)%W,sy=(i*97+27+Math.floor(t*8))%H;circle(g,sx,sy,i%5===0?1.6:.7,'#b3e1ff66');}
 }
 function ship(px,py){g.save();g.translate(px,py);g.fillStyle='#92e6ff';g.beginPath();g.moveTo(0,-21);g.lineTo(18,18);g.lineTo(0,11);g.lineTo(-18,18);g.closePath();g.fill();rect(g,-5,12,10,12,'#f8ca85',3);g.restore();}
 function move(dt){const dx=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0);x=clamp(x+dx*dt*405,32,W-32);}
 function overlayText(s){text(g,s,24,34,16,'#b7cce4');}
 function tick(dt){
  t+=dt;spawn-=dt;cool=Math.max(0,cool-dt);glowing=Math.max(0,glowing-dt);bg();
  const speed=1+Math.min(1.6,t/45);
  if(id==='meteor-dodge'){
   move(dt);if(spawn<=0){objects.push({x:random(20,700),y:-40,r:random(14,29),vy:random(130,230)*speed});spawn=random(.24,.52)/speed;}
   for(let i=objects.length-1;i>=0;i--){const o=objects[i];o.y+=o.vy*dt;circle(g,o.x,o.y,o.r,'#d89177');circle(g,o.x-6,o.y-5,o.r*.28,'#f3c29a');if(Math.hypot(o.x-x,o.y-350)<o.r+14)ctx.end('Ship destroyed');if(o.y>H+o.r){objects.splice(i,1);ctx.add(1);}}
   ship(x,350);overlayText('DODGE THE STORM');
  }
  if(id==='sky-glider'){
   v+=640*dt;y+=v*dt;if(spawn<=0){objects.push({x:W+30,gap:random(150,310),passed:false});spawn=1.5/speed;}
   for(const o of objects){o.x-=180*speed*dt;rect(g,o.x,0,66,o.gap-75,'#448e9d',6);rect(g,o.x,o.gap+75,66,H,'#448e9d',6);rect(g,o.x-4,o.gap-85,74,11,'#8dd9dd',3);rect(g,o.x-4,o.gap+74,74,11,'#8dd9dd',3);if(o.x<132&&o.x+66>102&&(y<o.gap-62||y>o.gap+62))ctx.end('Flight ended');if(!o.passed&&o.x+66<108){o.passed=true;ctx.add(1);}}
   if(y<15||y>H-15)ctx.end('Flight ended');objects.splice(0,objects.findIndex(o=>o.x>-80)<0?objects.length:0);
   g.save();g.translate(108,y);g.rotate(clamp(v/500,-.4,.75));g.fillStyle='#f7d399';g.beginPath();g.moveTo(22,0);g.lineTo(-14,-13);g.lineTo(-8,0);g.lineTo(-14,13);g.closePath();g.fill();g.restore();overlayText('FIND THE OPENING');
  }
  if(id==='neon-runner'){
   v+=1220*dt;y=clamp(y+v*dt,0,350);if(y>=350)v=0;
   if(spawn<=0){objects.push({x:W+24,w:random(26,48),h:random(35,82),passed:false});spawn=random(.8,1.3)/speed;}
   rect(g,0,375,W,5,'#7fc7e0');rect(g,128,y-36,34,36,'#83e8f4',7);
   for(const o of objects){o.x-=260*speed*dt;rect(g,o.x,375-o.h,o.w,o.h,'#faac8e',5);if(hitBox(o.x,375-o.h,o.w,o.h,145,y-16,16))ctx.end('Runner stopped');if(!o.passed&&o.x+o.w<145){o.passed=true;ctx.add(1);}}
   for(let i=objects.length-1;i>=0;i--)if(objects[i].x< -70)objects.splice(i,1);overlayText('JUMP THE BLOCKS');
  }
  if(id==='lane-drift'){
   if(spawn<=0){objects.push({lane:Math.floor(random(0,3)),y:-70,passed:false});spawn=random(.48,.86)/speed;}
   for(let i=0;i<4;i++)rect(g,180+i*120,0,3,H,'#a7b8d230');
   for(const o of objects){o.y+=210*speed*dt;rect(g,218+o.lane*120,o.y,52,74,'#e99a99',10);rect(g,228+o.lane*120,o.y+16,32,22,'#293852',5);if(o.lane===lane&&o.y<382&&o.y+74>332)ctx.end('Traffic collision');if(!o.passed&&o.y>H){o.passed=true;ctx.add(1);}}
   for(let i=objects.length-1;i>=0;i--)if(objects[i].y>H+80)objects.splice(i,1);
   rect(g,218+lane*120,348,52,74,'#8edcf9',10);rect(g,228+lane*120,365,32,24,'#203c5e',5);overlayText('SWITCH LANES');
  }
  if(id==='color-catcher'){
   move(dt);if(spawn<=0){objects.push({x:random(35,680),y:-20,hue:Math.floor(random(0,3))});spawn=random(.36,.65)/speed;}
   const colors=['#80d9ff','#ffc779','#ff96b7'];for(let i=0;i<3;i++)rect(g,25+i*105,22,80,8,i===target?colors[i]:'#ffffff24',4);
   for(let i=objects.length-1;i>=0;i--){const o=objects[i];o.y+=185*speed*dt;circle(g,o.x,o.y,18,colors[o.hue]);if(o.y>=342){if(Math.abs(o.x-x)<55){if(o.hue===target){ctx.add(2);collected++;if(collected%4===0)target=Math.floor(random(0,3));}else lives--;}else if(o.hue===target)lives--;objects.splice(i,1);if(lives<=0)ctx.end('No catches left');}}
   rect(g,x-51,354,102,19,'#a5d9f4',5);rect(g,x-39,373,78,9,'#436887',3);text(g,'LIVES '+lives,590,35,15,'#e8f6ff');text(g,'CATCH '+['BLUE','AMBER','PINK'][target],25,62,15,colors[target]);
  }
  if(id==='moving-targets'){
   for(const o of objects){o.x+=o.vx*dt;o.y+=o.vy*dt;if(o.x<o.r||o.x>W-o.r)o.vx*=-1;if(o.y<o.r+24||o.y>H-o.r)o.vy*=-1;circle(g,o.x,o.y,o.r,o.hue);circle(g,o.x,o.y,o.r*.52,'#10233c');circle(g,o.x,o.y,o.r*.19,o.hue);}
   if(t>=30)ctx.end('Time is up');overlayText('30-SECOND TARGET RUSH');
  }
  if(id==='pulse-guard'){
   if(spawn<=0){const a=random(0,TAU);objects.push({x:360+Math.cos(a)*350,y:220+Math.sin(a)*270,v:random(65,110)*speed});spawn=random(.55,1.05)/speed;}
   for(const o of objects){const a=Math.atan2(220-o.y,360-o.x);o.x+=Math.cos(a)*o.v*dt;o.y+=Math.sin(a)*o.v*dt;circle(g,o.x,o.y,12,'#f5a0b3');if(Math.hypot(360-o.x,220-o.y)<32)ctx.end('Station breached');}
   g.strokeStyle='#6596cb44';g.lineWidth=2;g.beginPath();g.arc(360,220,150,0,TAU);g.stroke();circle(g,360,220,27,'#6fcad9');circle(g,360,220,12,'#deffff');if(glowing>0){g.strokeStyle='#9be9ffbb';g.lineWidth=8*glowing/.3;g.beginPath();g.arc(360,220,150*(1-glowing/.3)+32,0,TAU);g.stroke();}
   text(g,cool>0?'RECHARGING':'PULSE READY',360,380,18,cool>0?'#88a4c5':'#9af8e0','center');
  }
  if(id==='gravity-swap'){
   if(spawn<=0){objects.push({x:W+30,lane:Math.floor(random(0,2)),passed:false});spawn=random(.7,1.1)/speed;}
   rect(g,0,46,W,5,'#91dfff');rect(g,0,390,W,5,'#91dfff');const py=lane===0?75:361;
   for(const o of objects){o.x-=250*speed*dt;rect(g,o.x,o.lane===0?51:340,38,50,'#f4a9a1',6);if(o.lane===lane&&o.x<146&&o.x+38>115)ctx.end('Gravity run ended');if(!o.passed&&o.x+38<115){o.passed=true;ctx.add(1);}}
   for(let i=objects.length-1;i>=0;i--)if(objects[i].x<-50)objects.splice(i,1);
   circle(g,130,py,19,'#8bd7fb');circle(g,130,py,7,'#16354c');overlayText('FLIP TO THE SAFE SIDE');
  }
  if(id==='orbit-escape'){
   angle+=dir*(1.65+Math.min(t/50,.6))*dt;if(spawn<=0){objects.push({a:random(0,TAU),speed:random(-.85,.85),r:14,life:random(5,8)});spawn=random(1.5,2.2);}
   g.strokeStyle='#9ec8ef66';g.lineWidth=3;g.beginPath();g.arc(360,220,120,0,TAU);g.stroke();circle(g,360,220,32,'#326c89');circle(g,360,220,12,'#88dbef');
   const px=360+Math.cos(angle)*120,py=220+Math.sin(angle)*120;
   for(let i=objects.length-1;i>=0;i--){const o=objects[i];o.a+=o.speed*dt;o.life-=dt;const ox=360+Math.cos(o.a)*120,oy=220+Math.sin(o.a)*120;circle(g,ox,oy,o.r,'#e49b9c');if(Math.hypot(ox-px,oy-py)<27)ctx.end('Orbit interrupted');if(o.life<0)objects.splice(i,1);}
   circle(g,px,py,12,'#98f1e2');scoreTimer+=dt;if(scoreTimer>=1){scoreTimer-=1;ctx.add(1);}if(t>=35)ctx.end('Orbit complete');overlayText('AVOID THE ORBITING THREATS');
  }
  if(id==='laser-gates'){
   move(dt);if(spawn<=0){objects.push({y:-15,gap:random(100,620),size:random(115,170),checked:false});spawn=random(.95,1.4)/speed;}
   for(const o of objects){o.y+=180*speed*dt;const left=clamp(o.gap-o.size/2,0,W),right=clamp(o.gap+o.size/2,0,W);
    rect(g,0,o.y,left,13,'#f18fa0',4);rect(g,right,o.y,W-right,13,'#f18fa0',4);
    if(!o.checked&&o.y+13>=348){o.checked=true;if(x<left+17||x>right-17)ctx.end('Laser contact');else ctx.add(1);}
   }
   for(let i=objects.length-1;i>=0;i--)if(objects[i].y>H+20)objects.splice(i,1);
   circle(g,x,360,16,'#92e6ff');circle(g,x,360,6,'#1e3e59');overlayText('STAY INSIDE THE GAPS');
  }
 }
 return {tick};
}
