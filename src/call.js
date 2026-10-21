import {SpeechGate} from './speech-gate.js';
import {socketURL} from './config.js';
import {mediaError} from './util.js';
export const QUALITY={auto:{width:3840,height:2160,frameRate:60,bitrate:18000000},1080:{width:1920,height:1080,frameRate:60,bitrate:10000000},720:{width:1280,height:720,frameRate:30,bitrate:4500000}};
export class CallEngine extends EventTarget{
 constructor({api,user,settings}){super();Object.assign(this,{api,user,settings});this.links=new Map();this.remote=new Map();this.mic=null;this.camera=null;this.screen=null;this.info=null;this.socket=null;this.muted=!!settings.muted||!!settings.pushToTalk;this.deafened=false;this.closed=true;this.stats=[];this.signalQueue=[];this.status='';this.speaking=new Map();this.speechDetectors=new Map();}
 change(){this.dispatchEvent(new Event('change'));}
 async join(info,members){
  if(this.info?.id===info.id&&!this.closed)return;
  if(!this.closed)await this.leave();this.closed=false;this.device=crypto.randomUUID();this.info=info;this.members=members;this.status='Connecting';this.started=Date.now();this.change();
  try{
   const config=await this.api('/ice');if(this.closed||this.info?.id!==info.id)return;this.ice=config.iceServers;this.relayAvailable=config.relay;const raw=await navigator.mediaDevices.getUserMedia({audio:this.audioConstraints(),video:false});if(this.closed||this.info?.id!==info.id){raw.getTracks().forEach(t=>t.stop());return}this.mic=await this.processMic(raw);if(this.closed)return;this.mic.getAudioTracks().forEach(t=>t.enabled=!this.muted);
   if(info.kind==='video')try{await this.enableCamera(true)}catch(error){this.error(mediaError(error));}
   await this.api('/calls/'+info.id+'/join',{method:'POST'});await this.connect();if(this.closed)return;this.statsTimer=setInterval(()=>this.collectStats(),2500);this.wake();this.change();
  }catch(error){this.error(mediaError(error));await this.leave();throw error;}
 }
 audioConstraints(){return {deviceId:this.settings.input?{exact:this.settings.input}:undefined,echoCancellation:this.settings.echo!==false,noiseSuppression:this.settings.noise!==false,autoGainControl:this.settings.gain!==false,channelCount:1,sampleRate:48000,latency:{ideal:0.01}};}
 error(message){this.dispatchEvent(new CustomEvent('error',{detail:message}));}
 async wake(){try{this.wakeLock=await navigator.wakeLock?.request('screen')}catch{}}
 async connect(){
  if(this.closed)return;const id=this.info.id;const {ticket}=await this.api('/ticket',{method:'POST',body:{scope:'call:'+id}});if(this.closed||this.info.id!==id)return;const url=socketURL('/calls/'+id+'/live',ticket)+'&device='+encodeURIComponent(this.device);this.socket=new WebSocket(url);
  this.socket.onopen=()=>{this.retries=0;this.status='Waiting for others';this.publish();this.change();this.pingTimer=setInterval(()=>this.send({type:'ping'}),25000);};
  this.socket.onmessage=event=>{try{this.receive(JSON.parse(event.data)).catch(error=>this.error(error.message))}catch{}};
  this.socket.onclose=event=>{clearInterval(this.pingTimer);if(event.code===4001){this.leave({transferred:true});this.error('Call transferred to another device.');return;}if(this.closed)return;if(event.code===1000&&event.reason==='Left call')return;this.status='Reconnecting';this.change();for(const link of this.links.values())link.pc.close();this.links.clear();this.remote.clear();clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.api('/session',{method:'POST'}).then(()=>this.connect()).catch(()=>this.leave()),Math.min(15000,700*2**(this.retries||0)));this.retries=(this.retries||0)+1;};
 }
 send(data){if(this.socket?.readyState===1){this.socket.send(JSON.stringify(data));return true}return false;}
 publish(){this.send({type:'state',state:{mic:!this.muted,camera:!!this.camera,screen:!!this.screen,deaf:this.deafened}});}
 async receive(msg){
  if(this.closed)return;
  if(msg.type==='peers'){for(const p of msg.peers){this.remote.set(p.uid,{uid:p.uid,state:p.state,streams:{}});const link=this.peer(p.uid);if(this.user.uid<p.uid)await link.offer();}this.publish();this.change();return;}
  if(msg.type==='peer-joined'){if(msg.uid===this.user.uid)return;this.remote.set(msg.uid,{uid:msg.uid,state:{},streams:{}});const link=this.peer(msg.uid);if(this.user.uid<msg.uid)await link.offer();this.publish();this.change();return;}
  if(msg.type==='peer-left'){this.links.get(msg.uid)?.close();this.links.delete(msg.uid);this.remote.delete(msg.uid);this.speechDetectors.get(msg.uid)?.stop();this.speechDetectors.delete(msg.uid);this.speaking.delete(msg.uid);this.status=this.links.size?'Connected':'Waiting for others';this.change();return;}
  if(msg.type==='state'){const p=this.remote.get(msg.uid);if(p)p.state=msg.state;this.change();return;}
  if(msg.type==='sound'&&['message1','camera_on','stream_started','user_join'].includes(msg.sound)){this.dispatchEvent(new CustomEvent('soundboard',{detail:{uid:msg.uid,sound:msg.sound}}));return;}
  if(['description','candidate'].includes(msg.type)){const link=this.peer(msg.from);await link.receive(msg);}
 }
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
  this.settings.facing=this.settings.facing==='environment'?'user':'environment';
  this.settings.camera='';
  await this.enableCamera(true);
  return this.settings.facing;
 }
 async processMic(raw){this.rawMic?.getTracks().forEach(t=>t.stop());this.rawMic=raw;this.audioContext??=new AudioContext({latencyHint:'interactive'});await this.audioContext.resume();this.micSource?.disconnect();this.inputGain?.disconnect();this.micSource=this.audioContext.createMediaStreamSource(raw);this.inputGain=this.audioContext.createGain();const destination=this.audioContext.createMediaStreamDestination();this.micSource.connect(this.inputGain);this.inputGain.connect(destination);this.setInputVolume(this.settings.inputVolume??100);this.monitorSpeech(this.user.uid,destination.stream);return destination.stream;}
 setInputVolume(value){if(this.inputGain)this.inputGain.gain.setTargetAtTime(Math.max(0,Math.min(2,value/100)),this.audioContext.currentTime,.015);}
 async switchInput(){const stream=await this.processMic(await navigator.mediaDevices.getUserMedia({audio:this.audioConstraints(),video:false}));stream.getAudioTracks()[0].enabled=!this.muted;const old=this.mic;this.mic=stream;await Promise.all([...this.links.values()].map(l=>l.replace('mic',stream.getAudioTracks()[0])));old?.getTracks().forEach(t=>t.stop());this.change();}
 toggleMute(){this.muted=!this.muted;if(this.muted)this.speaking.set(this.user.uid,false);this.mic?.getAudioTracks().forEach(t=>t.enabled=!this.muted);this.publish();this.change();}
 setPushToTalk(active){if(!this.settings.pushToTalk||!this.info)return;const muted=!active;if(this.muted===muted)return;this.muted=muted;if(muted)this.speaking.set(this.user.uid,false);this.mic?.getAudioTracks().forEach(track=>track.enabled=active);this.publish();this.change();}
 playSound(sound){if(!['message1','camera_on','stream_started','user_join'].includes(sound))return false;return this.send({type:'sound',sound});}
 toggleDeafen(){this.deafened=!this.deafened;if(this.deafened&&!this.muted){this.restoreMic=true;this.toggleMute()}else if(!this.deafened&&this.restoreMic){this.restoreMic=false;this.toggleMute()}this.publish();this.change();}
 async startShare({quality='auto',mode='motion',audio=true}={}){
  if(this.closed)throw Error('Join a call before sharing.');
  const q=QUALITY[quality]||QUALITY.auto;
  const stream=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:q.width},height:{ideal:q.height},frameRate:{ideal:mode==='text'?30:q.frameRate,max:mode==='text'?30:q.frameRate}},audio:audio?{echoCancellation:false,noiseSuppression:false,autoGainControl:false}:false,systemAudio:audio?'include':'exclude',surfaceSwitching:'include',selfBrowserSurface:'exclude',monitorTypeSurfaces:'include'});
  if(this.closed){stream.getTracks().forEach(t=>t.stop());return;}
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
 async leave({transferred=false}={}){
  if(this.closed)return;this.closed=true;for(const d of this.speechDetectors.values())d.stop();this.speechDetectors.clear();this.speaking.clear();clearInterval(this.statsTimer);clearInterval(this.pingTimer);clearTimeout(this.reconnectTimer);this.socket?.close(1000,'Left call');this.socket=null;for(const link of this.links.values())link.close();this.links.clear();for(const stream of [this.mic,this.camera,this.screen])stream?.getTracks().forEach(t=>t.stop());this.rawMic?.getTracks().forEach(t=>t.stop());this.rawMic=null;this.audioContext?.close().catch(()=>{});this.audioContext=null;this.mic=this.camera=this.screen=null;this.remote.clear();this.wakeLock?.release().catch(()=>{});const id=this.info?.id;this.info=null;this.status='';this.change();if(id&&!transferred)await this.api('/calls/'+id+'/leave',{method:'POST',body:{device:this.device}}).catch(()=>{});
 }
}
class Peer{
 constructor(engine,uid){
  this.engine=engine;this.uid=uid;this.polite=engine.user.uid>uid;this.makingOffer=false;this.ignoreOffer=false;this.pending=[];this.restarts=0;this.pc=new RTCPeerConnection({iceServers:engine.ice,bundlePolicy:'max-bundle'});
  this.transceivers={};if(engine.user.uid<uid)for(const [key,kind,track]of [['mic','audio',engine.mic?.getAudioTracks()[0]],['camera','video',engine.camera?.getVideoTracks()[0]],['screen','video',engine.screen?.getVideoTracks()[0]],['screenAudio','audio',engine.screen?.getAudioTracks()[0]]])this.transceivers[key]=this.pc.addTransceiver(track||kind,{direction:'sendrecv'});
  this.pc.onicecandidate=e=>{if(e.candidate)engine.send({type:'candidate',to:uid,candidate:e.candidate.toJSON()})};
  this.pc.ontrack=e=>{let peer=engine.remote.get(uid);if(!peer){peer={uid,state:{},streams:{}};engine.remote.set(uid,peer);}const key=Object.keys(this.transceivers).find(key=>this.transceivers[key]===e.transceiver)||['mic','camera','screen','screenAudio'][this.pc.getTransceivers().indexOf(e.transceiver)];if(key){peer.streams[key]=new MediaStream([e.track]);if(key==='mic')engine.monitorSpeech(uid,peer.streams[key]);e.track.onunmute=()=>engine.change();e.track.onmute=()=>engine.change();}engine.change();};
  // Four permanent media slots avoid adding transceivers during track changes.
  this.pc.onnegotiationneeded=null;
  this.pc.onconnectionstatechange=()=>{const state=this.pc.connectionState;if(state==='connected'){engine.status='Connected';if(engine.info)engine.info.status='active';this.restarts=0;this.tune().catch(()=>{});}if(state==='failed'&&this.restarts++<3){this.pc.restartIce();this.offer().catch(()=>{});}if(state==='disconnected'){clearTimeout(this.disconnectTimer);this.disconnectTimer=setTimeout(()=>{if(this.pc.connectionState==='disconnected'){this.pc.restartIce();this.offer().catch(()=>{});}},3000);}if(state==='failed')engine.status='Connection failed — check network or rejoin';engine.change();};
  for(const tx of Object.values(this.transceivers)){try{if('jitterBufferTarget'in tx.receiver)tx.receiver.jitterBufferTarget=50}catch{}}
 }
 async offer(){if(this.pc.signalingState!=='stable'||this.makingOffer)return;this.ready=true;try{this.makingOffer=true;await this.pc.setLocalDescription();this.engine.send({type:'description',to:this.uid,description:this.pc.localDescription.toJSON()});}finally{this.makingOffer=false}}
 async receive(msg){
  if(msg.type==='description'){const description=msg.description;const offerCollision=description.type==='offer'&&(this.makingOffer||this.pc.signalingState!=='stable');this.ignoreOffer=!this.polite&&offerCollision;if(this.ignoreOffer)return;await this.pc.setRemoteDescription(description);if(!Object.keys(this.transceivers).length){const slots=['mic','camera','screen','screenAudio'];for(const [i,tx]of this.pc.getTransceivers().entries()){const kind=slots[i];if(!kind)continue;this.transceivers[kind]=tx;tx.direction='sendrecv';await tx.sender.replaceTrack(kind==='mic'?this.engine.mic?.getAudioTracks()[0]||null:kind==='screenAudio'?this.engine.screen?.getAudioTracks()[0]||null:this.engine[kind]?.getVideoTracks()[0]||null);}}this.ready=true;for(const candidate of this.pending.splice(0))await this.pc.addIceCandidate(candidate).catch(()=>{});if(description.type==='offer'){await this.pc.setLocalDescription();this.engine.send({type:'description',to:this.uid,description:this.pc.localDescription.toJSON()});}await this.tune();}
  else if(msg.candidate){if(!this.pc.remoteDescription)this.pending.push(msg.candidate);else try{await this.pc.addIceCandidate(msg.candidate)}catch(e){if(!this.ignoreOffer)throw e}}
 }
 async replace(kind,track){if(this.transceivers[kind])await this.transceivers[kind].sender.replaceTrack(track);await this.tune();}
 async tune(){const peers=Math.max(1,this.engine.links.size),q=QUALITY[this.engine.shareOptions?.quality]||QUALITY.auto;for(const [kind,tx]of Object.entries(this.transceivers)){const sender=tx.sender;if(!sender.track)continue;try{const params=sender.getParameters();if(!params.encodings?.length)continue;const scale=this.reduced?0.55:1;params.encodings[0].maxBitrate=Math.floor((kind==='screen'?q.bitrate:kind==='camera'?5000000:kind==='screenAudio'?192000:96000)*scale/(kind==='mic'||kind==='screenAudio'?1:Math.max(1,Math.sqrt(peers))));if(kind==='camera'||kind==='screen'){params.degradationPreference=kind==='screen'&&this.engine.shareOptions?.mode==='text'?'maintain-resolution':'maintain-framerate';params.encodings[0].maxFramerate=kind==='screen'&&this.engine.shareOptions?.mode==='text'?30:60;}await sender.setParameters(params);}catch{}}}
 close(){clearTimeout(this.disconnectTimer);this.pc.onconnectionstatechange=null;this.pc.onnegotiationneeded=null;this.pc.close();}
}
