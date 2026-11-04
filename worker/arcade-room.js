import {DurableObject} from 'cloudflare:workers';
import {createArcadeState,arcadeAction,publicArcadeState,stepSlither} from '../src/games/arcade-model.mjs';
export class ArcadeRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.timer=null;this.last=Date.now();this.saved=0;this.rates=new Map();ctx.blockConcurrencyWhile(async()=>{this.config=await ctx.storage.get('config');this.game=await ctx.storage.get('game')})}
 async fetch(req){
  const url=new URL(req.url);
  if(url.pathname==='/init'&&req.method==='POST'){
   if(this.config)return Response.json({ok:true});
   this.config=await req.json();this.game=createArcadeState(this.config.game,this.config.players.map(p=>p.uid));await this.save();await this.ctx.storage.setAlarm(Date.now()+86400000);return Response.json({ok:true});
  }
  if(url.pathname==='/close'){this.game.mode='closed';for(const socket of this.ctx.getWebSockets())socket.close(1000,'Game closed');clearInterval(this.timer);this.timer=null;await this.save();return Response.json({ok:true})}
  const uid=req.headers.get('x-arcade-user');
  if(!this.config||!this.game.players.includes(uid)||this.game.mode==='closed')return new Response('Game unavailable',{status:403});
  if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  for(const old of this.ctx.getWebSockets())if(old.deserializeAttachment()?.uid===uid)old.close(4001,'Connected on another device');
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.serializeAttachment({uid});this.ctx.acceptWebSocket(server);
  this.broadcast();this.ensureLoop();return new Response(null,{status:101,webSocket:client});
 }
 online(){return [...new Set(this.ctx.getWebSockets().filter(socket=>socket.readyState===1).map(socket=>socket.deserializeAttachment()?.uid))]}
 broadcast(){for(const socket of this.ctx.getWebSockets())try{socket.send(JSON.stringify({type:'state',config:this.config,state:publicArcadeState(this.game,socket.deserializeAttachment().uid),online:this.online(),serverTime:Date.now()}))}catch{}}
 async save(){await this.ctx.storage.put({config:this.config,game:this.game});this.saved=Date.now()}
 ensureLoop(){if(this.timer||this.game.game!=='slither'||this.game.mode!=='playing'||this.online().length===0)return;this.last=Date.now();this.timer=setInterval(()=>{const now=Date.now(),online=this.online();if(!online.length||this.game.mode!=='playing'){clearInterval(this.timer);this.timer=null;return}if(online.length===2){this.disconnectedAt=0;stepSlither(this.game,(now-this.last)/1000)}else{if(!this.disconnectedAt)this.disconnectedAt=now;if(now-this.disconnectedAt>15000){this.game.mode='finished';this.game.winner=online[0];this.game.ready=[];this.game.scores[this.game.players.indexOf(online[0])]++}}this.last=now;this.broadcast();if(this.game.mode!=='playing'||now-this.saved>5000)this.ctx.waitUntil(this.save())},50)}
 async webSocketMessage(socket,message){
  try{
   if(typeof message!=='string'||message.length>1000)throw Error('Invalid input.');
   const uid=socket.deserializeAttachment()?.uid,now=Date.now();let rate=this.rates.get(uid);if(!rate||now-rate.start>1000){rate={start:now,count:0};this.rates.set(uid,rate)}if(++rate.count>45)throw Error('Too many inputs.');
   const action=JSON.parse(message);if(action.type==='ping'){socket.send('{"type":"pong"}');return}
   arcadeAction(this.game,uid,action);
   if(action.type!=='steer'){await this.save();this.broadcast();this.ensureLoop()}
  }catch(error){try{socket.send(JSON.stringify({type:'error',message:error.message}))}catch{}}
 }
 async webSocketClose(socket,code,reason){try{socket.close(code===1006?1000:code,reason)}catch{}if(this.game){this.broadcast();await this.save()}if(!this.online().length){clearInterval(this.timer);this.timer=null}}
 async alarm(){clearInterval(this.timer);this.timer=null;for(const socket of this.ctx.getWebSockets())try{socket.close(1000,'Room expired')}catch{}this.game=null;this.config=null;await this.ctx.storage.deleteAll()}
 webSocketError(socket){return this.webSocketClose(socket,1011,'Connection interrupted')}
}
