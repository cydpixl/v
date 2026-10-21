import {SpeechGate} from './speech-gate.js';
import {socketURL} from './config.js';
import {mediaError} from './util.js';
export const QUALITY={auto:{width:3840,height:2160,frameRate:60,bitrate:18000000},1080:{width:1920,height:1080,frameRate:60,bitrate:10000000},720:{width:1280,height:720,frameRate:30,bitrate:4500000}};
export class CallEngine extends EventTarget{
 constructor({api,user,settings}){super();Object.assign(this,{api,user,settings});this.links=new Map();this.remote=new Map();this.mic=null;this.camera=null;this.screen=null;this.info=null;this.socket=null;this.muted=!!settings.muted||!!settings.pushToTalk;this.deafened=false;this.closed=true;this.stats=[];this.signalQueue=[];this.status='';this.speaking=new Map();this.speechDetectors=new Map();}
 change(){this.dispatchEvent(new Event('change'));}
 async join(info,members){
  if(this.info?.id===info.id&&!this.closed)return;
  if(!this.closed)await this.leave();const generation=this.generation=(this.generation||0)+1,current=()=>!this.closed&&this.generation===generation;this.closed=false;this.device=crypto.randomUUID();this.info={...info};this.members=members;this.status='Connecting';this.started=Date.now();this.change();
  try{
   const reserved=await this.api('/calls/'+info.id+'/join',{method:'POST',body:{device:this.device}});if(!current())return;this.info={...reserved.call};
   const config=this.iceConfiguration?.expiresAt>Date.now()+60000?this.iceConfiguration:await this.api('/ice');if(!current())return;this.iceConfiguration=config;this.ice=config.iceServers;this.relayAvailable=config.relay;const raw=await navigator.mediaDevices.getUserMedia({audio:this.audioConstraints(),video:false});if(!current()){raw.getTracks().forEach(t=>t.stop());return}const mic=await this.processMic(raw,generation);if(!current()||!mic)return;this.mic=mic;this.mic.getAudioTracks().forEach(t=>t.enabled=!this.muted);
   if(info.kind==='video')try{await this.enableCamera(true)}catch(error){this.error(mediaError(error));}
   if(!current())return;await this.connect(this.device);if(!current())return;this.statsTimer=setInterval(()=>this.collectStats(),2500);this.wake();this.change();
  }catch(error){if(!current())return;this.error(mediaError(error));await this.leave();throw error;}
 }
 audioConstraints(){return {deviceId:this.settings.input?{exact:this.settings.input}:undefined,echoCancellation:this.settings.echo!==false,noiseSuppression:this.settings.noise!==false,autoGainControl:this.settings.gain!==false,channelCount:1,sampleRate:48000,latency:{ideal:0.01}};}
 error(message){this.dispatchEvent(new CustomEvent('error',{detail:message}));}
 async wake(){const generation=this.generation;try{const lock=await navigator.wakeLock?.request('screen');if(this.closed||this.generation!==generation)await lock?.release();else this.wakeLock=lock;}catch{}}
 async connect(device){
  if(this.closed)return;const id=this.info.id,generation=this.generation;this.device=device||crypto.randomUUID();const session=this.device;await this.api('/calls/'+id+'/join',{method:'POST',body:{device:session,ready:true}});if(this.closed||this.generation!==generation)return;const {ticket}=await this.api('/ticket',{method:'POST',body:{scope:'call:'+id}});if(this.closed||this.generation!==generation)return;
  const url=socketURL('/calls/'+id+'/live',ticket)+'&device='+encodeURIComponent(session),socket=new WebSocket(url);this.socket=socket;
  const current=()=>!this.closed&&this.generation===generation&&this.socket===socket;let signals=Promise.resolve();
  socket.onmessage=event=>{let data;try{data=JSON.parse(event.data)}catch{return}signals=signals.then(()=>current()?this.receive(data):undefined).catch(error=>{if(current())this.error(error.message)});};
  await new Promise((resolve,reject)=>{
   let opened=false;const timeout=setTimeout(()=>{if(!current()){resolve();return;}if(!opened){socket.close();reject(Error('The call could not connect. Please rejoin.'));}},15000);this.cancelConnect=()=>{clearTimeout(timeout);resolve();};
   socket.onopen=()=>{clearTimeout(timeout);if(!current()){socket.close();resolve();return;}opened=true;this.retries=0;this.status='Waiting for others';this.publish();this.change();clearInterval(this.pingTimer);this.pingTimer=setInterval(()=>this.send({type:'ping'}),20000);resolve();};
   socket.onerror=()=>{if(!opened){clearTimeout(timeout);reject(Error('The call connection failed. Please rejoin.'));}};
   socket.onclose=event=>{clearTimeout(timeout);if(!opened)reject(Error('The call connection closed. Please rejoin.'));if(!current())return;clearInterval(this.pingTimer);if(event.code===4001){this.leave({transferred:true});this.error('Call transferred to another device.');return;}this.status='Reconnecting';for(const uid of [...this.remote.keys()])this.removePeer(uid);this.change();this.reconnect(generation);};
  });
 }
 reconnect(generation){clearTimeout(this.reconnectTimer);const delay=Math.min(15000,700*2**Math.min(this.retries||0,5));this.retries=(this.retries||0)+1;this.reconnectTimer=setTimeout(async()=>{if(this.closed||this.generation!==generation)return;try{await this.api('/session',{method:'POST'});await this.connect();}catch(error){if(this.closed||this.generation!==generation)return;if(error.status===410||error.status===401){this.error(error.message);await this.leave();}else this.reconnect(generation);}},delay);}
 send(data){if(this.socket?.readyState===1){this.socket.send(JSON.stringify(data));return true}return false;}
 publish(){this.send({type:'state',state:{mic:!this.muted,camera:!!this.camera,screen:!!this.screen,deaf:this.deafened}});}
 async receive(msg){
  if(this.closed)return;
  if(msg.type==='peers'||msg.type==='roster'){const peers=msg.peers.filter(p=>p.uid!==this.user.uid);for(const uid of [...this.remote.keys()])if(!peers.some(p=>p.uid===uid))this.removePeer(uid);for(const p of peers)await this.upsertPeer(p);if(msg.status&&this.info&&!(this.info.status==='active'&&msg.status==='ringing'))this.info.status=msg.status;if(peers.length&&this.info)this.info.status='active';if(msg.type==='peers')this.publish();this.change();return;}
  if(msg.type==='peer-joined'){if(msg.uid===this.user.uid)return;await this.upsertPeer(msg);if(this.info)this.info.status='active';this.publish();this.change();return;}
  if(msg.type==='peer-left'){const p=this.remote.get(msg.uid);if(msg.device&&p?.device&&msg.device!==p.device)return;this.removePeer(msg.uid);if(this.info)this.info.status='active';this.status=[...this.links.values()].some(l=>l.pc.connectionState==='connected')?'Connected':this.links.size?'Connecting':'Waiting for others';this.change();return;}
  if(msg.type==='state'){const p=this.remote.get(msg.uid);if(p&&(!msg.device||!p.device||msg.device===p.device))p.state=msg.state;this.change();return;}
  if(msg.type==='sound'&&['message1','camera_on','stream_started','user_join'].includes(msg.sound)){this.dispatchEvent(new CustomEvent('soundboard',{detail:{uid:msg.uid,sound:msg.sound}}));return;}
  if(['description','candidate'].includes(msg.type)){const p=this.remote.get(msg.from);if(!p||msg.device&&p.device&&msg.device!==p.device)return;const link=this.peer(msg.from);await link.receive(msg);}
 }
 removePeer(uid){this.links.get(uid)?.close();this.links.delete(uid);this.remote.delete(uid);this.speechDetectors.get(uid)?.stop();this.speechDetectors.delete(uid);this.speaking.delete(uid);}
 async upsertPeer(p){const prior=this.remote.get(p.uid);if(prior?.device&&p.device&&prior.device!==p.device)this.removePeer(p.uid);const peer=this.remote.get(p.uid)||{uid:p.uid,streams:{}};peer.device=p.device||peer.device;peer.state=p.state||peer.state||{};this.remote.set(p.uid,peer);const fresh=!this.links.has(p.uid),link=this.peer(p.uid);if(fresh&&this.user.uid<p.uid)await link.offer();}
 peer(uid){if(this.links.has(uid))return this.links.get(uid);const link=new Peer(this,uid);this.links.set(uid,link);return link;}
 async enableCamera(enabled=!this.camera){
  const request=this.cameraRequest=(this.cameraRequest||0)+1;
  if(!enabled){this.camera?.getTracks().forEach(t=>t.stop());this.camera=null;await Promise.all([...this.links.values()].map(l=>l.replace('camera',null)));this.publish();this.change();return;}
  const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{deviceId:this.settings.camera?{exact:this.settings.camera}:undefined,facingMode:this.settings.facing||'user',width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:60,max:60}}});
  if(this.closed||request!==this.cameraRequest){stream.getTracks().forEach(t=>t.stop());return}
  const old=this.camera;this.camera=stream;stream.getVideoTracks()[0].onended=()=>{if(this.camera===stream)this.enableCamera(false).catch(e=>this.error(e.message))};await Promise.all([...this.links.values()].map(l=>l.replace('camera',stream.getVideoTracks()[0])));old?.getTracks().forEach(t=>t.stop());this.publish();this.change();
 }
 async flipCamera(){
  if(!this.camera)throw Error('Turn on your camera before flipping it.');
  const track=this.camera.getVideoTracks()[0],current=track?.getSettings().deviceId,devices=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput');
  const index=devices.findIndex(device=>device.deviceId===current);
  if(devices.length>1){const next=devices[(index+1+devices.length)%devices.length];this.settings.camera=next.deviceId;this.settings.facing='';}
  else{this.settings.facing=this.settings.facing==='environment'?'user':'environment';this.settings.camera='';}
  await this.enableCamera(true);
  const active=this.camera?.getVideoTracks()[0];this.settings.camera=active?.getSettings().deviceId||this.settings.camera;this.settings.facing=active?.getSettings().facingMode||this.settings.facing;
  return active?.label||'Camera';
 }
 async processMic(raw,generation=this.generation){this.rawMic?.getTracks().forEach(t=>t.stop());this.rawMic=raw;const context=this.audioContext??=new AudioContext({latencyHint:'interactive'});await context.resume();if(this.closed||this.generation!==generation||this.audioContext!==context){raw.getTracks().forEach(t=>t.stop());return null;}this.micSource?.disconnect();this.inputGain?.disconnect();this.micSource=context.createMediaStreamSource(raw);this.inputGain=context.createGain();const destination=context.createMediaStreamDestination();this.micSource.connect(this.inputGain);this.inputGain.connect(destination);this.setInputVolume(this.settings.inputVolume??100);this.monitorSpeech(this.user.uid,destination.stream);return destination.stream;}
 setInputVolume(value){if(this.inputGain)this.inputGain.gain.setTargetAtTime(Math.max(0,Math.min(2,value/100)),this.audioContext.currentTime,.015);}
 async switchInput(){const generation=this.generation,raw=await navigator.mediaDevices.getUserMedia({audio:this.audioConstraints(),video:false});if(this.closed||this.generation!==generation){raw.getTracks().forEach(t=>t.stop());return;}const stream=await this.processMic(raw,generation);if(!stream)return;stream.getAudioTracks()[0].enabled=!this.muted;const old=this.mic;this.mic=stream;await Promise.all([...this.links.values()].map(l=>l.replace('mic',stream.getAudioTracks()[0])));old?.getTracks().forEach(t=>t.stop());this.change();}
 toggleMute(){this.muted=!this.muted;if(this.muted)this.speaking.set(this.user.uid,false);this.mic?.getAudioTracks().forEach(t=>t.enabled=!this.muted);this.publish();this.change();}
 setPushToTalk(active){if(!this.settings.pushToTalk||!this.info)return;const muted=!active;if(this.muted===muted)return;this.muted=muted;if(muted)this.speaking.set(this.user.uid,false);this.mic?.getAudioTracks().forEach(track=>track.enabled=active);this.publish();this.change();}
 playSound(sound){if(!['message1','camera_on','stream_started','user_join'].includes(sound))return false;return this.send({type:'sound',sound});}
 toggleDeafen(){this.deafened=!this.deafened;if(this.deafened&&!this.muted){this.restoreMic=true;this.toggleMute()}else if(!this.deafened&&this.restoreMic){this.restoreMic=false;this.toggleMute()}this.publish();this.change();}
 async startShare({quality='auto',mode='motion',audio=true}={}){
  if(this.closed)throw Error('Join a call before sharing.');
  const generation=this.generation,q=QUALITY[quality]||QUALITY.auto;
  const stream=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:q.width},height:{ideal:q.height},frameRate:{ideal:mode==='text'?30:q.frameRate,max:mode==='text'?30:q.frameRate}},audio:audio?{echoCancellation:false,noiseSuppression:false,autoGainControl:false}:false,systemAudio:audio?'include':'exclude',surfaceSwitching:'include',selfBrowserSurface:'exclude',monitorTypeSurfaces:'include'});
  if(this.closed||this.generation!==generation){stream.getTracks().forEach(t=>t.stop());return;}
  const old=this.screen;this.screen=stream;this.shareOptions={quality,mode,audio};const video=stream.getVideoTracks()[0];video.contentHint=mode==='text'?'detail':'motion';video.onended=()=>{if(this.screen===stream)this.stopShare()};
  await Promise.all([...this.links.values()].flatMap(l=>[l.replace('screen',video),l.replace('screenAudio',stream.getAudioTracks()[0]||null)]));old?.getTracks().forEach(t=>t.stop());this.publish();this.change();
 }
 async stopShare(){const old=this.screen;this.screen=null;await Promise.all([...this.links.values()].flatMap(l=>[l.replace('screen',null),l.replace('screenAudio',null)]));old?.getTracks().forEach(t=>t.stop());this.publish();this.change();}
 monitorSpeech(uid,stream){this.speechDetectors.get(uid)?.stop();if(!this.audioContext||!stream.getAudioTracks().length)return;const source=this.audioContext.createMediaStreamSource(stream),filter=this.audioContext.createBiquadFilter(),analyser=this.audioContext.createAnalyser();filter.type='bandpass';filter.frequency.value=1200;filter.Q.value=.5;analyser.fftSize=1024;source.connect(filter);filter.connect(analyser);const buffer=new Float32Array(1024),gate=new SpeechGate();const timer=setInterval(()=>{analyser.getFloatTimeDomainData(buffer);let mean=0;for(const x of buffer)mean+=x;mean/=buffer.length;let sum=0;for(const x of buffer)sum+=(x-mean)**2;const enabled=uid===this.user.uid?!this.muted:this.remote.get(uid)?.state?.mic!==false;const speaking=gate.sample(Math.sqrt(sum/buffer.length),enabled&&!this.closed);if(this.speaking.get(uid)!==speaking){this.speaking.set(uid,speaking);this.change()}},20);this.speechDetectors.set(uid,{stop(){clearInterval(timer);source.disconnect();filter.disconnect();analyser.disconnect()}});}
 async verificationCodes(){const result=[];for(const [uid,link]of this.links){const read=sdp=>[...String(sdp||'').matchAll(/^a=fingerprint:sha-256\s+([0-9a-f:]+)$/gim)].map(match=>match[1].replaceAll(':','').toLowerCase())[0];const local=read(link.pc.localDescription?.sdp),remote=read(link.pc.remoteDescription?.sdp);if(!local||!remote)continue;const material=[local,remote].sort().join(':');const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(material)));const code=[...digest.slice(0,12)].map(value=>value.toString(16).padStart(2,'0')).join('').match(/.{1,4}/g).join(' ');result.push({uid,code})}return result;}
 async collectStats(){
  if(this.closed)return;const result=[];
  for(const [uid,link]of this.links){try{const reports=await link.pc.getStats();let connection={uid,state:link.pc.connectionState,relay:false,rtt:0,outgoing:0,loss:0,video:[]};const values=[...reports.values()];const transport=values.find(r=>r.type==='transport'&&r.selectedCandidatePairId);const pair=transport?reports.get(transport.selectedCandidatePairId):values.find(r=>r.type==='candidate-pair'&&r.nominated&&r.state==='succeeded');if(pair){connection.rtt=Math.round((pair.currentRoundTripTime||0)*1000);connection.outgoing=pair.availableOutgoingBitrate||0;connection.relay=[reports.get(pair.localCandidateId),reports.get(pair.remoteCandidateId)].some(r=>r?.candidateType==='relay');}
    for(const r of values){if(r.type==='inbound-rtp'&&r.kind==='audio'){connection.loss=r.packetsLost>0?r.packetsLost/(r.packetsReceived+r.packetsLost):0;}if(r.type==='outbound-rtp'&&r.kind==='video')connection.video.push({width:r.frameWidth,height:r.frameHeight,fps:r.framesPerSecond,quality:r.qualityLimitationReason});}result.push(connection);
    // Keep the browser's congestion controller in charge; only cap the sender's envelope.
    if(connection.loss>0.08&&connection.rtt>350){link.reduced=true;await link.tune();}else if(link.reduced&&connection.loss<0.02&&connection.rtt<200){link.reduced=false;await link.tune();}
   }catch{}}
  this.stats=result;this.change();
 }
 async leave({transferred=false,keepalive=false}={}){
  if(this.closed)return;const id=this.info?.id,device=this.device;this.closed=true;this.generation=(this.generation||0)+1;this.cameraRequest=(this.cameraRequest||0)+1;for(const d of this.speechDetectors.values())d.stop();this.speechDetectors.clear();this.speaking.clear();clearInterval(this.statsTimer);clearInterval(this.pingTimer);clearTimeout(this.reconnectTimer);const socket=this.socket;this.socket=null;this.cancelConnect?.();this.cancelConnect=null;if(socket){socket.onopen=socket.onmessage=socket.onclose=socket.onerror=null;socket.close(1000,'Left call');}for(const link of this.links.values())link.close();this.links.clear();for(const stream of [this.mic,this.camera,this.screen])stream?.getTracks().forEach(t=>t.stop());this.rawMic?.getTracks().forEach(t=>t.stop());this.rawMic=null;this.audioContext?.close().catch(()=>{});this.audioContext=null;this.mic=this.camera=this.screen=null;this.remote.clear();this.wakeLock?.release().catch(()=>{});this.info=null;this.status='';this.change();if(id&&!transferred)await this.api('/calls/'+id+'/leave',{method:'POST',keepalive,body:{device}}).catch(()=>{});
 }
}
class Peer{
 constructor(engine,uid){
  this.engine=engine;this.uid=uid;this.device=engine.remote.get(uid)?.device;this.polite=engine.user.uid>uid;this.makingOffer=false;this.ignoreOffer=false;this.pending=[];this.restarts=0;this.pc=new RTCPeerConnection({iceServers:engine.ice,bundlePolicy:'max-bundle'});
  this.transceivers={};if(engine.user.uid<uid)for(const [key,kind,track]of [['mic','audio',engine.mic?.getAudioTracks()[0]],['camera','video',engine.camera?.getVideoTracks()[0]],['screen','video',engine.screen?.getVideoTracks()[0]],['screenAudio','audio',engine.screen?.getAudioTracks()[0]]])this.transceivers[key]=this.pc.addTransceiver(track||kind,{direction:'sendrecv'});
  this.pc.onicecandidate=e=>{if(e.candidate)this.signal({type:'candidate',candidate:e.candidate.toJSON()})};
  this.pc.ontrack=e=>{let peer=engine.remote.get(uid);if(!peer){peer={uid,state:{},streams:{}};engine.remote.set(uid,peer);}const key=Object.keys(this.transceivers).find(key=>this.transceivers[key]===e.transceiver)||this.mediaKey(e.transceiver);if(key){peer.streams[key]=new MediaStream([e.track]);if(key==='mic')engine.monitorSpeech(uid,peer.streams[key]);e.track.onunmute=()=>engine.change();e.track.onmute=()=>engine.change();}engine.change();};
  // Four permanent media slots avoid adding transceivers during track changes.
  this.pc.onnegotiationneeded=null;
  this.pc.onconnectionstatechange=()=>{if(engine.links.get(uid)!==this||engine.closed)return;const state=this.pc.connectionState;if(state==='connected'){engine.status='Connected';if(engine.info)engine.info.status='active';this.restarts=0;this.tune().catch(()=>{});}if(state==='failed'&&this.restarts++<3){this.pc.restartIce();this.offer().catch(()=>{});}if(state==='disconnected'){clearTimeout(this.disconnectTimer);this.disconnectTimer=setTimeout(()=>{if(this.pc.connectionState==='disconnected'){this.pc.restartIce();this.offer().catch(()=>{});}},3000);}if(state==='failed')engine.status='Connection failed — check network or rejoin';engine.change();};
  for(const tx of Object.values(this.transceivers)){try{if('jitterBufferTarget'in tx.receiver)tx.receiver.jitterBufferTarget=50}catch{}}
 }
 signal(data){if(!this.engine.closed&&this.engine.links.get(this.uid)===this)this.engine.send({...data,to:this.uid,toDevice:this.device});}
 async offer(){if(this.pc.signalingState!=='stable'||this.makingOffer)return;this.ready=true;try{this.makingOffer=true;await this.pc.setLocalDescription();this.signal({type:'description',description:this.pc.localDescription.toJSON()});}finally{this.makingOffer=false}}
 mediaKey(transceiver){const sdp=this.pc.remoteDescription?.sdp;if(!sdp||!transceiver.mid)return null;const sections=sdp.split(/\r?\nm=/).slice(1),index=sections.findIndex(section=>section.split(/\r?\n/).includes('a=mid:'+transceiver.mid));if(index<0)return null;const kind=sections[index].split(/[ \r\n]/,1)[0],ordinal=sections.slice(0,index).filter(section=>section.split(/[ \r\n]/,1)[0]===kind).length;return kind==='audio'?(ordinal===0?'mic':ordinal===1?'screenAudio':null):kind==='video'?(ordinal===0?'camera':ordinal===1?'screen':null):null;}
 async receive(msg){
  if(msg.type==='description'){const description=msg.description;const offerCollision=description.type==='offer'&&(this.makingOffer||this.pc.signalingState!=='stable');this.ignoreOffer=!this.polite&&offerCollision;if(this.ignoreOffer)return;await this.pc.setRemoteDescription(description);if(!Object.keys(this.transceivers).length){for(const tx of this.pc.getTransceivers()){const kind=this.mediaKey(tx);if(!kind)continue;this.transceivers[kind]=tx;tx.direction='sendrecv';await tx.sender.replaceTrack(kind==='mic'?this.engine.mic?.getAudioTracks()[0]||null:kind==='screenAudio'?this.engine.screen?.getAudioTracks()[0]||null:this.engine[kind]?.getVideoTracks()[0]||null);}}this.ready=true;for(const candidate of this.pending.splice(0))await this.pc.addIceCandidate(candidate).catch(()=>{});if(description.type==='offer'){await this.pc.setLocalDescription();this.signal({type:'description',description:this.pc.localDescription.toJSON()});}await this.tune();}
  else if(msg.candidate){if(!this.pc.remoteDescription)this.pending.push(msg.candidate);else try{await this.pc.addIceCandidate(msg.candidate)}catch(e){if(!this.ignoreOffer)throw e}}
 }
 async replace(kind,track){if(this.pc.signalingState==='closed'||this.engine.links.get(this.uid)!==this)return;try{if(this.transceivers[kind])await this.transceivers[kind].sender.replaceTrack(track);}catch(error){if(this.pc.signalingState!=='closed'&&this.engine.links.get(this.uid)===this)throw error;}await this.tune();}
 async tune(){const peers=Math.max(1,this.engine.links.size),q=QUALITY[this.engine.shareOptions?.quality]||QUALITY.auto;for(const [kind,tx]of Object.entries(this.transceivers)){const sender=tx.sender;if(!sender.track)continue;try{const params=sender.getParameters();if(!params.encodings?.length)continue;const scale=this.reduced?0.55:1;params.encodings[0].maxBitrate=Math.floor((kind==='screen'?q.bitrate:kind==='camera'?5000000:kind==='screenAudio'?192000:96000)*scale/(kind==='mic'||kind==='screenAudio'?1:Math.max(1,Math.sqrt(peers))));if(kind==='camera'||kind==='screen'){params.degradationPreference=kind==='screen'&&this.engine.shareOptions?.mode==='text'?'maintain-resolution':'maintain-framerate';params.encodings[0].maxFramerate=kind==='screen'&&this.engine.shareOptions?.mode==='text'?30:60;}await sender.setParameters(params);}catch{}}}
 close(){clearTimeout(this.disconnectTimer);this.pc.onconnectionstatechange=null;this.pc.onnegotiationneeded=null;this.pc.onicecandidate=null;this.pc.ontrack=null;this.pc.close();}
}
