export const QUALITY={auto:{width:3840,height:2160,frameRate:60,bitrate:18000000},1080:{width:1920,height:1080,frameRate:60,bitrate:10000000},720:{width:1280,height:720,frameRate:30,bitrate:4500000}};

export function audioLoss(previous,current){
 const received=Number(current.packetsReceived)||0,lost=Math.max(0,Number(current.packetsLost)||0);
 if(!previous||received<previous.received||lost<previous.lost)return {received,lost,loss:0};
 const missing=lost-previous.lost,total=received-previous.received+missing;
 return {received,lost,loss:total>0?missing/total:0};
}

export function senderEnvelope(kind,{peers=1,reduced=false,available=0,screen=false,quality='auto',mode='motion'}={}){
 const q=QUALITY[quality]||QUALITY.auto;
 if(kind==='mic'||kind==='screenAudio')return {maxBitrate:kind==='mic'?96000:192000};
 const share=Math.max(1,Math.sqrt(peers)),base=(kind==='screen'?q.bitrate:2500000)/share;
 const budget=available>0?Math.max(250000,available*.8-160000):Infinity;
 const portion=screen?(kind==='camera'?.25:.75):1;
 const bitrate=Math.max(kind==='camera'?120000:200000,Math.floor(Math.min(base*(reduced?.6:1),budget*portion)));
 return {maxBitrate:bitrate,maxFramerate:kind==='camera'?30:mode==='text'?Math.min(30,q.frameRate):q.frameRate,
  scaleResolutionDownBy:kind==='camera'?(bitrate<400000?3:bitrate<900000?2:1):1};
}
